-- LeadTrove custom objects (Settings > Objects).
-- Run this in Supabase > SQL Editor > New query > Run. It is safe to run again and does not delete anything.
-- Run it AFTER supabase/permissions.sql.

create table if not exists custom_objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- singular, e.g. "Property"
  plural text not null,          -- e.g. "Properties"
  slug text not null unique,     -- used in the address: /objects/properties
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references custom_objects(id) on delete cascade,
  label text not null,
  key text not null,
  type text not null check (type in ('text', 'number', 'date', 'dropdown', 'yesno')),
  options text[] not null default '{}',   -- choices for a dropdown
  required boolean not null default false,
  position int not null default 0,
  unique (object_id, key)
);

create table if not exists custom_records (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references custom_objects(id) on delete cascade,
  owner_id uuid references profiles(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_records_object_idx on custom_records (object_id);

alter table custom_objects enable row level security;
alter table custom_fields enable row level security;
alter table custom_records enable row level security;

drop policy if exists "objects read" on custom_objects;
drop policy if exists "objects manage" on custom_objects;
drop policy if exists "fields read" on custom_fields;
drop policy if exists "fields manage" on custom_fields;
drop policy if exists "records read" on custom_records;
drop policy if exists "records add" on custom_records;
drop policy if exists "records change" on custom_records;
drop policy if exists "records remove" on custom_records;

create policy "objects read" on custom_objects for select to authenticated using (true);
create policy "objects manage" on custom_objects for all to authenticated using (has_perm('objects.manage')) with check (has_perm('objects.manage'));
create policy "fields read" on custom_fields for select to authenticated using (true);
create policy "fields manage" on custom_fields for all to authenticated using (has_perm('objects.manage')) with check (has_perm('objects.manage'));

-- Records follow the same rules as contacts: you see your own (or everyone's if your role says so).
create policy "records read" on custom_records for select to authenticated
  using (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id));
create policy "records add" on custom_records for insert to authenticated
  with check (has_perm('records.edit') and (sees_all() or owner_id = auth.uid()));
create policy "records change" on custom_records for update to authenticated
  using (has_perm('records.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)))
  with check (has_perm('records.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)));
create policy "records remove" on custom_records for delete to authenticated
  using (has_perm('records.edit') and (sees_all() or owner_id = auth.uid() or shared_with_me(owner_id, true)));

grant select, insert, update, delete on custom_objects, custom_fields, custom_records to authenticated;
grant all on custom_objects, custom_fields, custom_records to service_role;

-- Two new permissions. Reps and Managers may work with records; only Owners define objects by default; Viewers change nothing.
update roles set permissions = permissions || '{"objects.manage":false,"records.edit":true}'::jsonb
  where name in ('Rep', 'Manager') and not (permissions ? 'records.edit');
update roles set permissions = permissions || '{"objects.manage":false,"records.edit":false}'::jsonb
  where name = 'Viewer' and not (permissions ? 'records.edit');
update roles set permissions = permissions || '{"objects.manage":true,"records.edit":true}'::jsonb
  where name = 'Owner';
