-- LeadTrove lead capture forms (Module 7)
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run again.

alter table lead_forms add column if not exists heading text not null default 'Get in touch';
alter table lead_forms add column if not exists description text;
alter table lead_forms add column if not exists success_message text not null default 'Thanks! We''ll be in touch shortly.';
alter table lead_forms add column if not exists tags text[] not null default '{}';
alter table lead_forms add column if not exists source text not null default 'Website Form';
alter table lead_forms add column if not exists is_active boolean not null default true;
alter table lead_forms add column if not exists submission_count int not null default 0;

-- What a visitor is allowed to see about a form (and nothing else).
create or replace function get_public_form(form_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'heading', heading, 'description', description, 'success_message', success_message)
  from lead_forms where slug = form_slug and is_active;
$$;

-- What happens when a visitor submits: the ONLY way the public can write to LeadTrove.
-- It validates the input, creates (or finds) the contact, assigns an owner, logs a note
-- with a "make first contact" next step, and creates a follow-up task.
create or replace function submit_lead_form(
  form_slug text, p_first text, p_last text, p_email text, p_phone text, p_company text, p_message text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f lead_forms%rowtype;
  v_first text := nullif(btrim(coalesce(p_first, '')), '');
  v_last text := btrim(coalesce(p_last, ''));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_company text := nullif(btrim(coalesce(p_company, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_company_id uuid;
  v_contact uuid;
  v_owner uuid;
  v_existing boolean := false;
begin
  select * into f from lead_forms where slug = form_slug and is_active;
  if not found then return jsonb_build_object('ok', false, 'error', 'This form is not available.'); end if;

  if v_first is null then return jsonb_build_object('ok', false, 'error', 'Please enter your first name.'); end if;
  if v_email is null and v_phone is null then return jsonb_build_object('ok', false, 'error', 'Please give us an email address or a phone number.'); end if;
  if v_email is not null and v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return jsonb_build_object('ok', false, 'error', 'That email address doesn''t look right.'); end if;
  if length(v_first) > 100 or length(v_last) > 100 or length(coalesce(v_email, '')) > 200 or length(coalesce(v_phone, '')) > 40
     or length(coalesce(v_company, '')) > 200 or length(coalesce(v_message, '')) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'One of the answers is too long.');
  end if;

  -- Already in LeadTrove? Then do not create a duplicate. Just log the new enquiry on them.
  select id, owner_id into v_contact, v_owner from contacts
  where (v_email is not null and lower(email) = lower(v_email))
     or (v_phone is not null and regexp_replace(phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g'))
  limit 1;
  v_existing := found;

  if not v_existing then
    if v_company is not null then
      select id into v_company_id from companies where lower(name) = lower(v_company) limit 1;
      if v_company_id is null then insert into companies (name) values (v_company) returning id into v_company_id; end if;
    end if;
    -- owner_id null (auto-assign) is filled in by the "new lead -> assign owner" automation
    insert into contacts (first_name, last_name, email, phone, company_id, owner_id, source, status, tags)
    values (v_first, v_last, v_email, v_phone, v_company_id, f.default_owner_id, f.source, 'new', f.tags)
    returning id, owner_id into v_contact, v_owner;
  end if;

  insert into activities (contact_id, user_id, type, outcome, notes, next_step)
  values (v_contact, v_owner, 'note', case when v_existing then 'Form re-submitted' else 'Form submitted' end,
          'Form: ' || f.name || coalesce(E'\n' || v_message, ''), 'Make first contact');

  update contacts set last_activity_at = now(), is_stale = false where id = v_contact;

  insert into tasks (title, contact_id, assigned_to, due_at)
  values ('Make first contact: ' || v_first || ' ' || v_last, v_contact, v_owner, now() + interval '1 day');

  update lead_forms set submission_count = submission_count + 1 where id = f.id;
  return jsonb_build_object('ok', true);
end $$;

-- Visitors are not logged in, so they use the "anon" role. They can run these two functions and nothing else.
grant execute on function get_public_form(text) to anon, authenticated;
grant execute on function submit_lead_form(text, text, text, text, text, text, text) to anon, authenticated;
