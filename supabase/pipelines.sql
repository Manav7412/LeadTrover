-- LeadTrove custom pipelines
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run again.

-- Every stage now has a type: 'open' (in progress), 'won' or 'lost'.
-- This lets any pipeline have its own Won / Lost stages, whatever they are called.
alter table stages add column if not exists outcome text not null default 'open'
  check (outcome in ('open', 'won', 'lost'));

update stages set outcome = 'won'
  where name = 'Won' and pipeline_id = (select id from pipelines where name = 'Sales');
update stages set outcome = 'lost'
  where name = 'Lost' and pipeline_id = (select id from pipelines where name = 'Sales');

-- Anyone signed in can create and edit pipelines and their stages.
drop policy if exists "write pipelines" on pipelines;
create policy "write pipelines" on pipelines for all to authenticated using (true) with check (true);
drop policy if exists "write stages" on stages;
create policy "write stages" on stages for all to authenticated using (true) with check (true);

-- Safety: a pipeline that still has deals can never be deleted (so nobody's deals vanish).
alter table deals drop constraint if exists deals_pipeline_id_fkey;
alter table deals add constraint deals_pipeline_id_fkey
  foreign key (pipeline_id) references pipelines(id) on delete restrict;

-- If a stage's type changes (say Open -> Won), the deals sitting in it follow.
create or replace function sync_deal_status_with_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outcome is distinct from old.outcome then
    update deals set status = new.outcome where stage_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists stages_sync_deals on stages;
create trigger stages_sync_deals after update of outcome on stages
  for each row execute function sync_deal_status_with_stage();
