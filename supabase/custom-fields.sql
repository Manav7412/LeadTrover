-- Custom fields on standard objects (Contacts, Deals): e.g. add "Address" or "Postal Code" to Contacts.
-- Run in Supabase > SQL Editor > New query > Run, AFTER supabase/objects.sql. Safe to run again; deletes nothing.

alter table custom_fields alter column object_id drop not null;
alter table custom_fields add column if not exists standard_object text;

alter table custom_fields drop constraint if exists custom_fields_standard_object_check;
alter table custom_fields add constraint custom_fields_standard_object_check check (standard_object in ('contacts', 'deals'));

alter table custom_fields drop constraint if exists custom_fields_one_parent;
alter table custom_fields add constraint custom_fields_one_parent check ((object_id is null) <> (standard_object is null));

create unique index if not exists custom_fields_standard_key on custom_fields (standard_object, key) where standard_object is not null;

-- Where the values are stored (one small JSON object per row)
alter table contacts add column if not exists custom jsonb not null default '{}';
alter table deals add column if not exists custom jsonb not null default '{}';
