-- LeadTrove roles, permissions and sharing rules
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run again.
-- Run it LAST (after schema, automations, pipelines, forms and dashboard): it replaces the access rules.

-- ---------------------------------------------------------------------------
-- Profile extras
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists phone text;

-- ---------------------------------------------------------------------------
-- Roles: a name, a data scope ("own" = only records assigned to them, "all" = everyone's)
-- and a set of on/off permissions.
-- ---------------------------------------------------------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system boolean not null default false,
  data_scope text not null default 'own' check (data_scope in ('own', 'all')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists role_id uuid references roles(id) on delete restrict;

insert into roles (name, description, is_system, data_scope, permissions) values
  ('Owner', 'Full access to everything. This role is locked.', true, 'all',
   '{"contacts.create":true,"contacts.edit":true,"contacts.delete":true,"contacts.import":true,"contacts.export":true,"deals.create":true,"deals.edit":true,"deals.delete":true,"pipelines.manage":true,"tasks.manage":true,"activities.log":true,"templates.manage":true,"forms.manage":true,"dashboard.view":true,"team.manage":true,"roles.manage":true}'),
  ('Rep', 'Sales reps: work their own leads, deals and tasks.', true, 'own',
   '{"contacts.create":true,"contacts.edit":true,"contacts.delete":true,"contacts.import":true,"contacts.export":true,"deals.create":true,"deals.edit":true,"deals.delete":true,"pipelines.manage":true,"tasks.manage":true,"activities.log":true,"templates.manage":true,"forms.manage":false,"dashboard.view":true,"team.manage":false,"roles.manage":false}'),
  ('Manager', 'Sees the whole team''s records and runs the pipeline, but cannot manage people or roles.', false, 'all',
   '{"contacts.create":true,"contacts.edit":true,"contacts.delete":true,"contacts.import":true,"contacts.export":true,"deals.create":true,"deals.edit":true,"deals.delete":true,"pipelines.manage":true,"tasks.manage":true,"activities.log":true,"templates.manage":true,"forms.manage":true,"dashboard.view":true,"team.manage":false,"roles.manage":false}'),
  ('Viewer', 'Read-only: sees everything and the dashboard, changes nothing.', false, 'all',
   '{"contacts.create":false,"contacts.edit":false,"contacts.delete":false,"contacts.import":false,"contacts.export":false,"deals.create":false,"deals.edit":false,"deals.delete":false,"pipelines.manage":false,"tasks.manage":false,"activities.log":false,"templates.manage":false,"forms.manage":false,"dashboard.view":true,"team.manage":false,"roles.manage":false}')
on conflict (name) do nothing;

-- Everyone who already exists gets the matching role.
update profiles set role_id = (select id from roles where name = case profiles.role when 'owner' then 'Owner' else 'Rep' end)
where role_id is null;

-- The Owner role is locked, and built-in roles cannot be deleted.
create or replace function protect_system_roles() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then raise exception 'Built-in roles cannot be deleted.'; end if;
    return old;
  end if;
  if old.name = 'Owner' then raise exception 'The Owner role is locked.'; end if;
  if old.is_system and (new.name is distinct from old.name or new.is_system is distinct from old.is_system) then
    raise exception 'Built-in roles cannot be renamed.';
  end if;
  return new;
end $$;
drop trigger if exists roles_protect on roles;
create trigger roles_protect before update or delete on roles for each row execute function protect_system_roles();

-- ---------------------------------------------------------------------------
-- Sharing rules: "the records of from_user can be seen (or edited) by to_user"
-- ---------------------------------------------------------------------------
create table if not exists sharing_rules (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  access text not null default 'view' check (access in ('view', 'edit')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);

-- ---------------------------------------------------------------------------
-- Helper functions used by the access rules below
-- ---------------------------------------------------------------------------
create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

-- Does the signed-in person's role switch this permission on?
create or replace function has_perm(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_owner() or coalesce(
    (select (r.permissions ->> perm)::boolean from profiles p join roles r on r.id = p.role_id where p.id = auth.uid()), false);
$$;

-- Can the signed-in person see everyone's records (role scope = all)?
create or replace function sees_all() returns boolean
language sql stable security definer set search_path = public as $$
  select is_owner() or coalesce(
    (select r.data_scope = 'all' from profiles p join roles r on r.id = p.role_id where p.id = auth.uid()), false);
$$;

-- Has the owner of a record shared their records with the signed-in person?
create or replace function shared_with_me(record_owner uuid, need_edit boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select record_owner is not null and exists (
    select 1 from sharing_rules s
    where s.from_user = record_owner and s.to_user = auth.uid() and (not need_edit or s.access = 'edit'));
$$;

-- Marks a contact as recently worked (used when someone logs activity, even if they can't edit the contact itself).
create or replace function touch_contact(cid uuid) returns void
language sql security definer set search_path = public as $$
  update contacts set last_activity_at = now(), is_stale = false
  where id = cid and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id));
$$;

grant execute on function is_owner(), has_perm(text), sees_all(), shared_with_me(uuid, boolean), touch_contact(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Access rules (row-level security). These replace the earlier, simpler rules.
-- ---------------------------------------------------------------------------
alter table roles enable row level security;
alter table sharing_rules enable row level security;

do $$
declare pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('contacts','deals','tasks','activities','companies','pipelines','stages','email_templates','lead_forms','roles','sharing_rules')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Contacts
create policy "contacts read" on contacts for select to authenticated
  using (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id));
create policy "contacts add" on contacts for insert to authenticated
  with check (has_perm('contacts.create') and (sees_all() or owner_id = auth.uid()));
create policy "contacts change" on contacts for update to authenticated
  using (has_perm('contacts.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)))
  with check (has_perm('contacts.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)));
create policy "contacts remove" on contacts for delete to authenticated
  using (has_perm('contacts.delete') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)));

-- Deals
create policy "deals read" on deals for select to authenticated
  using (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id));
create policy "deals add" on deals for insert to authenticated
  with check (has_perm('deals.create') and (sees_all() or owner_id = auth.uid()));
create policy "deals change" on deals for update to authenticated
  using (has_perm('deals.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)))
  with check (has_perm('deals.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)));
create policy "deals remove" on deals for delete to authenticated
  using (has_perm('deals.delete') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)));

-- Tasks (belong to whoever they are assigned to)
create policy "tasks read" on tasks for select to authenticated
  using (sees_all() or assigned_to = auth.uid() or shared_with_me(assigned_to));
create policy "tasks add" on tasks for insert to authenticated
  with check ((has_perm('tasks.manage') or has_perm('activities.log')) and (sees_all() or assigned_to = auth.uid() or shared_with_me(assigned_to, true)));
create policy "tasks change" on tasks for update to authenticated
  using (has_perm('tasks.manage') and (sees_all() or assigned_to = auth.uid() or shared_with_me(assigned_to, true)))
  with check (has_perm('tasks.manage') and (sees_all() or assigned_to = auth.uid() or shared_with_me(assigned_to, true)));
create policy "tasks remove" on tasks for delete to authenticated
  using (has_perm('tasks.manage') and (sees_all() or assigned_to = auth.uid() or shared_with_me(assigned_to, true)));

-- Activities follow the contact: if you can see the contact, you can see its history
create policy "activities read" on activities for select to authenticated
  using (exists (select 1 from contacts c where c.id = contact_id));
create policy "activities add" on activities for insert to authenticated
  with check (has_perm('activities.log') and exists (select 1 from contacts c where c.id = contact_id));
create policy "activities change" on activities for update to authenticated
  using (has_perm('activities.log') and exists (select 1 from contacts c where c.id = contact_id))
  with check (has_perm('activities.log') and exists (select 1 from contacts c where c.id = contact_id));
create policy "activities remove" on activities for delete to authenticated
  using (has_perm('activities.log') and exists (select 1 from contacts c where c.id = contact_id));

-- Companies are shared by the whole team
create policy "companies read" on companies for select to authenticated using (true);
create policy "companies add" on companies for insert to authenticated
  with check (has_perm('contacts.create') or has_perm('contacts.edit') or has_perm('contacts.import'));
create policy "companies change" on companies for update to authenticated
  using (has_perm('contacts.edit')) with check (has_perm('contacts.edit'));
create policy "companies remove" on companies for delete to authenticated using (has_perm('contacts.delete'));

-- Pipelines and stages
create policy "pipelines read" on pipelines for select to authenticated using (true);
create policy "pipelines manage" on pipelines for all to authenticated using (has_perm('pipelines.manage')) with check (has_perm('pipelines.manage'));
create policy "stages read" on stages for select to authenticated using (true);
create policy "stages manage" on stages for all to authenticated using (has_perm('pipelines.manage')) with check (has_perm('pipelines.manage'));

-- Email templates and lead forms
create policy "templates read" on email_templates for select to authenticated using (true);
create policy "templates manage" on email_templates for all to authenticated using (has_perm('templates.manage')) with check (has_perm('templates.manage'));
create policy "forms manage" on lead_forms for all to authenticated using (has_perm('forms.manage')) with check (has_perm('forms.manage'));

-- Roles: everyone can read them (to know what they may do); only people who manage roles can change them
create policy "roles read" on roles for select to authenticated using (true);
create policy "roles add" on roles for insert to authenticated with check (has_perm('roles.manage') and not is_system);
create policy "roles change" on roles for update to authenticated using (has_perm('roles.manage')) with check (has_perm('roles.manage'));
create policy "roles remove" on roles for delete to authenticated using (has_perm('roles.manage') and not is_system);

-- Sharing rules: you can see rules that involve you; you can share your own records;
-- people who manage roles can set up any rule.
create policy "sharing read" on sharing_rules for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or has_perm('roles.manage'));
create policy "sharing add" on sharing_rules for insert to authenticated
  with check (from_user = auth.uid() or has_perm('roles.manage'));
create policy "sharing change" on sharing_rules for update to authenticated
  using (from_user = auth.uid() or has_perm('roles.manage')) with check (from_user = auth.uid() or has_perm('roles.manage'));
create policy "sharing remove" on sharing_rules for delete to authenticated
  using (from_user = auth.uid() or has_perm('roles.manage'));

grant select, insert, update, delete on roles, sharing_rules to authenticated;
grant all on roles, sharing_rules to service_role;
