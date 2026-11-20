-- LeadTrove automations (Module 6)
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again. Run supabase/schema.sql first on a brand-new project.

-- A deal created by the "Won" automation remembers which deal it came from.
alter table deals add column if not exists source_deal_id uuid references deals(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 1. NEW LEAD -> ASSIGN OWNER
-- If a contact is added with no owner, give it to the team member with the
-- fewest open leads (ties go to whoever was given a lead longest ago).
-- ---------------------------------------------------------------------------
create or replace function assign_owner_to_new_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is null then
    select p.id into new.owner_id
    from profiles p
    left join contacts c on c.owner_id = p.id and c.status in ('new', 'contacted', 'qualified')
    group by p.id
    order by count(c.id), coalesce(max(c.created_at), '-infinity'::timestamptz), p.created_at
    limit 1;
  end if;
  return new;
end $$;

drop trigger if exists contacts_assign_owner on contacts;
create trigger contacts_assign_owner before insert on contacts
  for each row execute function assign_owner_to_new_contact();

-- ---------------------------------------------------------------------------
-- 2. DEAL MARKED WON -> CREATE ONBOARDING DEAL (+ a "book kickoff" task)
-- ---------------------------------------------------------------------------
create or replace function create_onboarding_deal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sales_id uuid;
  onboarding_id uuid;
  signed_id uuid;
  new_deal_id uuid;
begin
  if new.status = 'won' and (tg_op = 'INSERT' or old.status is distinct from 'won') then
    select id into sales_id from pipelines where name = 'Sales';
    if new.pipeline_id is distinct from sales_id then return new; end if;
    if exists (select 1 from deals where source_deal_id = new.id) then return new; end if;

    select id into onboarding_id from pipelines where name = 'Client Onboarding';
    select id into signed_id from stages where pipeline_id = onboarding_id and name = 'Signed';
    if signed_id is null then return new; end if;

    insert into deals (title, value, contact_id, company_id, pipeline_id, stage_id, owner_id, status, source_deal_id)
    values ('Onboarding: ' || new.title, new.value, new.contact_id, new.company_id, onboarding_id, signed_id, new.owner_id, 'open', new.id)
    returning id into new_deal_id;

    insert into tasks (title, contact_id, deal_id, assigned_to, due_at)
    values ('Book kickoff call: ' || new.title, new.contact_id, new_deal_id, new.owner_id, now() + interval '1 day');
  end if;
  return new;
end $$;

drop trigger if exists deals_create_onboarding on deals;
create trigger deals_create_onboarding after insert or update of status on deals
  for each row execute function create_onboarding_deal();

-- ---------------------------------------------------------------------------
-- 3. NO ACTIVITY FOR 7 DAYS -> FLAG THE LEAD AS STALE
-- Customers and lost contacts are never stale. Logging activity clears the flag.
-- ---------------------------------------------------------------------------
create or replace function refresh_stale_leads() returns void
language sql security definer set search_path = public as $$
  update contacts c
  set is_stale = (c.status not in ('customer', 'lost') and coalesce(c.last_activity_at, c.created_at) < now() - interval '7 days')
  where c.is_stale is distinct from (c.status not in ('customer', 'lost') and coalesce(c.last_activity_at, c.created_at) < now() - interval '7 days');
$$;

grant execute on function refresh_stale_leads() to authenticated, service_role;

-- Run the stale check every hour if pg_cron is available. If not, no problem:
-- the app also refreshes the flags whenever Contacts or Home is opened.
do $$
begin
  create extension if not exists pg_cron;
  begin perform cron.unschedule('leadtrove-stale-leads'); exception when others then null; end;
  perform cron.schedule('leadtrove-stale-leads', '0 * * * *', 'select public.refresh_stale_leads()');
exception when others then
  raise notice 'pg_cron is not available - stale flags will refresh when the app loads.';
end $$;

select refresh_stale_leads();
