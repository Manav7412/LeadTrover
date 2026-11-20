-- LeadTrove database schema (fake demo data only)
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- It is safe to run again: it wipes and recreates the LeadTrove tables.
-- After it, also run supabase/automations.sql (automations) supabase/pipelines.sql (custom pipelines), supabase/forms.sql (lead forms) and supabase/dashboard.sql (dashboard).

drop table if exists lead_forms, email_templates, tasks, activities, deals, stages, pipelines, contacts, companies, profiles cascade;
drop function if exists is_owner();

-- ---------- Tables ----------

-- One row per login user. "role" is either 'owner' (sees everything) or 'rep' (sees own records).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('owner', 'rep')),
  created_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  size text,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  company_id uuid references companies(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  source text not null default 'Manual',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'customer', 'lost')),
  tags text[] not null default '{}',
  is_stale boolean not null default false,
  last_activity_at timestamptz,
  created_at timestamptz not null default now()
);
-- Duplicate protection (Module 2): the same email or phone can only exist once.
create unique index contacts_email_unique on contacts (lower(email)) where email is not null;
-- Phone numbers are compared by digits only, so "+1 555 0100" and "(1) 555-0100" count as the same.
create unique index contacts_phone_unique on contacts ((regexp_replace(phone, '\D', '', 'g'))) where phone is not null and phone <> '';

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  position int not null,
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')) -- open = in progress
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  value numeric(12, 2) not null default 0,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  pipeline_id uuid not null references pipelines(id) on delete restrict,
  stage_id uuid not null references stages(id),
  owner_id uuid references profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  closed_at timestamptz, -- when the deal was won or lost (set by supabase/dashboard.sql)
  source_deal_id uuid references deals(id) on delete set null, -- set when the "Won" automation creates an onboarding deal
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('call', 'email', 'note', 'meeting')),
  outcome text,
  notes text,
  next_step text,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_id uuid references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  due_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table lead_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Fixed pipeline setup ----------

with p as (
  insert into pipelines (name, position) values ('Sales', 1), ('Client Onboarding', 2) returning id, name
)
insert into stages (pipeline_id, name, position, outcome)
select p.id, s.name, s.position, s.outcome
from p
join (values
  ('Sales', 'New', 1, 'open'), ('Sales', 'Contacted', 2, 'open'), ('Sales', 'Meeting Booked', 3, 'open'),
  ('Sales', 'Proposal Sent', 4, 'open'), ('Sales', 'Won', 5, 'won'), ('Sales', 'Lost', 6, 'lost'),
  ('Client Onboarding', 'Signed', 1, 'open'), ('Client Onboarding', 'Kickoff Booked', 2, 'open'),
  ('Client Onboarding', 'Setup in Progress', 3, 'open'), ('Client Onboarding', 'Live', 4, 'open')
) as s(pipeline, name, position, outcome) on s.pipeline = p.name;

-- ---------- Security: who can see what ----------

create function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

alter table profiles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table deals enable row level security;
alter table activities enable row level security;
alter table tasks enable row level security;
alter table email_templates enable row level security;
alter table lead_forms enable row level security;

-- Everyone logged in can see the team list, pipelines, stages, companies and templates.
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "read pipelines" on pipelines for select to authenticated using (true);
create policy "read stages" on stages for select to authenticated using (true);
create policy "read companies" on companies for select to authenticated using (true);
create policy "write companies" on companies for all to authenticated using (true) with check (true);
create policy "all templates" on email_templates for all to authenticated using (true) with check (true);
create policy "owner forms" on lead_forms for all to authenticated using (is_owner()) with check (is_owner());

-- Owner sees everything. A Rep only sees records assigned to them.
create policy "contacts access" on contacts for all to authenticated
  using (is_owner() or owner_id = auth.uid()) with check (is_owner() or owner_id = auth.uid());
create policy "deals access" on deals for all to authenticated
  using (is_owner() or owner_id = auth.uid()) with check (is_owner() or owner_id = auth.uid());
create policy "tasks access" on tasks for all to authenticated
  using (is_owner() or assigned_to = auth.uid()) with check (is_owner() or assigned_to = auth.uid());
-- Activity history belongs to the contact: whoever owns the contact can see it.
create policy "activities access" on activities for all to authenticated
  using (is_owner() or exists (select 1 from contacts c where c.id = contact_id and c.owner_id = auth.uid()))
  with check (is_owner() or exists (select 1 from contacts c where c.id = contact_id and c.owner_id = auth.uid()));

-- Table permissions (RLS above then narrows these down)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- The seed script and server code use the secret (service_role) key; newer Supabase
-- projects don't grant it access to your own tables automatically.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant execute on function is_owner() to authenticated, service_role;
