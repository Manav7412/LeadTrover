-- LeadTrove file attachments and folders on contacts.
-- Run in Supabase > SQL Editor > New query > Run, AFTER supabase/permissions.sql. Safe to run again; deletes nothing.

-- 1) A private storage bucket for the files (25 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('contact-files', 'contact-files', false, 26214400)
on conflict (id) do update set file_size_limit = 26214400, public = false;

-- 2) Folders (each contact has its own tree) and file records
create table if not exists contact_folders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  parent_id uuid references contact_folders(id) on delete cascade,
  name text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contact_folders_contact_idx on contact_folders (contact_id);

create table if not exists contact_files (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  folder_id uuid references contact_folders(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  size bigint not null default 0,
  mime_type text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contact_files_contact_idx on contact_files (contact_id);

alter table contact_folders enable row level security;
alter table contact_files enable row level security;

-- 3) Who can do what. Seeing files follows seeing the contact; changing files needs the new "files.manage" permission
--    and the right to edit that contact.
drop policy if exists "folders read" on contact_folders;
drop policy if exists "folders add" on contact_folders;
drop policy if exists "folders change" on contact_folders;
drop policy if exists "folders remove" on contact_folders;
drop policy if exists "files read" on contact_files;
drop policy if exists "files add" on contact_files;
drop policy if exists "files change" on contact_files;
drop policy if exists "files remove" on contact_files;

create policy "folders read" on contact_folders for select to authenticated
  using (exists (select 1 from contacts c where c.id = contact_id));
create policy "folders add" on contact_folders for insert to authenticated
  with check (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));
create policy "folders change" on contact_folders for update to authenticated
  using (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))))
  with check (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));
create policy "folders remove" on contact_folders for delete to authenticated
  using (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));

create policy "files read" on contact_files for select to authenticated
  using (exists (select 1 from contacts c where c.id = contact_id));
create policy "files add" on contact_files for insert to authenticated
  with check (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));
create policy "files change" on contact_files for update to authenticated
  using (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))))
  with check (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));
create policy "files remove" on contact_files for delete to authenticated
  using (has_perm('files.manage') and exists (select 1 from contacts c where c.id = contact_id and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));

grant select, insert, update, delete on contact_folders, contact_files to authenticated;
grant all on contact_folders, contact_files to service_role;

-- 4) The stored files themselves: the first part of a file's path is the contact's id, so the same rules apply.
drop policy if exists "contact files read" on storage.objects;
drop policy if exists "contact files add" on storage.objects;
drop policy if exists "contact files remove" on storage.objects;

create policy "contact files read" on storage.objects for select to authenticated
  using (bucket_id = 'contact-files' and exists (select 1 from contacts c where c.id::text = (storage.foldername(name))[1]));
create policy "contact files add" on storage.objects for insert to authenticated
  with check (bucket_id = 'contact-files' and has_perm('files.manage')
    and exists (select 1 from contacts c where c.id::text = (storage.foldername(name))[1] and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));
create policy "contact files remove" on storage.objects for delete to authenticated
  using (bucket_id = 'contact-files' and has_perm('files.manage')
    and exists (select 1 from contacts c where c.id::text = (storage.foldername(name))[1] and (sees_all() or c.owner_id = auth.uid() or shared_with_me(c.owner_id, true))));

-- 5) The new permission: Reps and Managers can manage files, Viewers cannot (Owner can always).
update roles set permissions = permissions || '{"files.manage":true}'::jsonb
  where name in ('Rep', 'Manager') and not (permissions ? 'files.manage');
update roles set permissions = permissions || '{"files.manage":false}'::jsonb
  where name = 'Viewer' and not (permissions ? 'files.manage');
