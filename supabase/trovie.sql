-- Trovie (AI assistant): a small daily-usage counter so nobody can run up the AI bill.
-- Run in Supabase > SQL Editor > New query > Run. Safe to run again; deletes nothing.

create table if not exists trovie_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table trovie_usage enable row level security;
drop policy if exists "trovie usage own" on trovie_usage;
create policy "trovie usage own" on trovie_usage for select to authenticated using (user_id = auth.uid());
grant select on trovie_usage to authenticated;
grant all on trovie_usage to service_role;

-- Adds one to today's count for the signed-in person and returns the new total.
create or replace function trovie_hit() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  insert into trovie_usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (user_id, day) do update set count = trovie_usage.count + 1
  returning count into n;
  return n;
end $$;
grant execute on function trovie_hit() to authenticated, service_role;
