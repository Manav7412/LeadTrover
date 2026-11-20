-- LeadTrove dashboard support (Module 9)
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run again.

-- When was a deal closed (won or lost)? The dashboard needs this for win rate "in the last 30 days".
alter table deals add column if not exists closed_at timestamptz;

-- Existing closed deals get a reasonable date (a week after they were created, but never in the future).
update deals set closed_at = least(now(), created_at + interval '7 days')
where status in ('won', 'lost') and closed_at is null;

-- Keep it up to date: set when a deal becomes won/lost, cleared if it is re-opened.
create or replace function set_deal_closed_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'open' then
    new.closed_at := null;
  elsif tg_op = 'INSERT' then
    new.closed_at := coalesce(new.closed_at, now());
  elsif old.status is distinct from new.status then
    new.closed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists deals_set_closed_at on deals;
create trigger deals_set_closed_at before insert or update of status on deals
  for each row execute function set_deal_closed_at();
