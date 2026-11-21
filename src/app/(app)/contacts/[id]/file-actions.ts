"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { DENIED, can } from "@/lib/permissions";
import {
  BLOCKED_EXTENSIONS, FILES_BUCKET, MAX_FILE_BYTES, MAX_FOLDER_DEPTH, MAX_NAME_LENGTH, extensionOf, folderDepth, folderSubtree, parseTags, safeStorageName,
  type FolderRow,
} from "@/lib/files";

type Result = { error?: string };

const cleanName = (v: string) => v.replace(/[\\/\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();

async function ctx() {
  const c = await requireProfile();
  if (!can(c.profile, "files.manage")) return { error: DENIED } as const;
  return c;
}

async function loadFolders(supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"], contactId: string) {
  const { data } = await supabase.from("contact_folders").select("id, contact_id, parent_id, name, created_at").eq("contact_id", contactId);
  return (data ?? []) as FolderRow[];
}

const refresh = (contactId: string) => revalidatePath(`/contacts/${contactId}`);

// ---------- Folders ----------

export async function createFolder(contactId: string, parentId: string | null, rawName: string): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const name = cleanName(rawName);
  if (!name) return { error: "Give the folder a name." };
  if (name.length > MAX_NAME_LENGTH) return { error: `Folder names can be up to ${MAX_NAME_LENGTH} characters.` };
  const folders = await loadFolders(c.supabase, contactId);
  if (parentId && !folders.some((f) => f.id === parentId)) return { error: "That folder no longer exists." };
  if (folderDepth(folders, parentId) >= MAX_FOLDER_DEPTH) return { error: `Folders can be nested up to ${MAX_FOLDER_DEPTH} levels deep.` };
  if (folders.some((f) => f.parent_id === parentId && f.name.toLowerCase() === name.toLowerCase())) return { error: "A folder with that name already exists here." };
  const { error } = await c.supabase.from("contact_folders").insert({ contact_id: contactId, parent_id: parentId, name, created_by: c.profile.id });
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

export async function renameFolder(contactId: string, folderId: string, rawName: string): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const name = cleanName(rawName);
  if (!name) return { error: "Give the folder a name." };
  if (name.length > MAX_NAME_LENGTH) return { error: `Folder names can be up to ${MAX_NAME_LENGTH} characters.` };
  const folders = await loadFolders(c.supabase, contactId);
  const me = folders.find((f) => f.id === folderId);
  if (!me) return { error: "That folder no longer exists." };
  if (folders.some((f) => f.id !== folderId && f.parent_id === me.parent_id && f.name.toLowerCase() === name.toLowerCase())) return { error: "A folder with that name already exists here." };
  const { error } = await c.supabase.from("contact_folders").update({ name }).eq("id", folderId).eq("contact_id", contactId);
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

export async function moveFolder(contactId: string, folderId: string, newParentId: string | null): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const folders = await loadFolders(c.supabase, contactId);
  const me = folders.find((f) => f.id === folderId);
  if (!me) return { error: "That folder no longer exists." };
  const subtree = folderSubtree(folders, folderId);
  if (newParentId && subtree.includes(newParentId)) return { error: "A folder can't be moved into itself." };
  if (newParentId && !folders.some((f) => f.id === newParentId)) return { error: "That destination no longer exists." };
  const deepest = Math.max(...subtree.map((id) => folderDepth(folders, id) - folderDepth(folders, folderId) + 1));
  if (folderDepth(folders, newParentId) + deepest > MAX_FOLDER_DEPTH) return { error: `That would nest folders more than ${MAX_FOLDER_DEPTH} levels deep.` };
  if (folders.some((f) => f.id !== folderId && f.parent_id === newParentId && f.name.toLowerCase() === me.name.toLowerCase())) return { error: "A folder with that name already exists there." };
  const { error } = await c.supabase.from("contact_folders").update({ parent_id: newParentId }).eq("id", folderId).eq("contact_id", contactId);
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

// Deletes a folder, its subfolders and every file inside (the files are removed from storage too).
export async function deleteFolder(contactId: string, folderId: string): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const folders = await loadFolders(c.supabase, contactId);
  if (!folders.some((f) => f.id === folderId)) return {};
  const ids = folderSubtree(folders, folderId);
  const { data: files } = await c.supabase.from("contact_files").select("storage_path").eq("contact_id", contactId).in("folder_id", ids);
  const paths = (files ?? []).map((f) => f.storage_path as string);
  if (paths.length) {
    const { error } = await c.supabase.storage.from(FILES_BUCKET).remove(paths);
    if (error) return { error: error.message };
  }
  const { error } = await c.supabase.from("contact_folders").delete().eq("id", folderId).eq("contact_id", contactId);
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

// ---------- Files ----------

export async function renameFile(contactId: string, fileId: string, rawName: string): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const name = cleanName(rawName);
  if (!name) return { error: "Give the file a name." };
  if (name.length > MAX_NAME_LENGTH) return { error: `File names can be up to ${MAX_NAME_LENGTH} characters.` };
  if (BLOCKED_EXTENSIONS.includes(extensionOf(name))) return { error: "That file type isn't allowed." };
  const { error } = await c.supabase.from("contact_files").update({ name }).eq("id", fileId).eq("contact_id", contactId);
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

export async function moveFile(contactId: string, fileId: string, folderId: string | null): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  if (folderId) {
    const folders = await loadFolders(c.supabase, contactId);
    if (!folders.some((f) => f.id === folderId)) return { error: "That destination no longer exists." };
  }
  const { error } = await c.supabase.from("contact_files").update({ folder_id: folderId }).eq("id", fileId).eq("contact_id", contactId);
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

export async function deleteFile(contactId: string, fileId: string): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const { data: file } = await c.supabase.from("contact_files").select("storage_path").eq("id", fileId).eq("contact_id", contactId).maybeSingle();
  if (!file) return {};
  const { error: storageError } = await c.supabase.storage.from(FILES_BUCKET).remove([file.storage_path]);
  if (storageError) return { error: storageError.message };
  const { error } = await c.supabase.from("contact_files").delete().eq("id", fileId);
  if (error) return { error: error.message };
  refresh(contactId); return {};
}

// ---------- Uploading ----------
// Files go straight from the browser to storage (so big files don't pass through the app server):
// 1) prepareUpload checks the rules and hands back a one-time upload link, 2) the browser uploads,
// 3) confirmUpload saves the file in the folder.

export async function prepareUpload(contactId: string, file: { name: string; size: number }): Promise<Result & { path?: string; token?: string }> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const name = cleanName(file.name);
  if (!name) return { error: "That file has no name." };
  if (name.length > MAX_NAME_LENGTH) return { error: `"${name.slice(0, 30)}…" has too long a name (up to ${MAX_NAME_LENGTH} characters).` };
  if (BLOCKED_EXTENSIONS.includes(extensionOf(name))) return { error: `"${name}": that file type isn't allowed.` };
  if (!(file.size > 0)) return { error: `"${name}" is empty.` };
  if (file.size > MAX_FILE_BYTES) return { error: `"${name}" is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  const path = `${contactId}/${crypto.randomUUID()}-${safeStorageName(name)}`;
  const { data, error } = await c.supabase.storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Couldn't start the upload. Has supabase/files.sql been run?" };
  return { path, token: data.token };
}

export async function confirmUpload(contactId: string, folderId: string | null, file: { path: string; name: string; size: number; type: string }): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  if (!file.path.startsWith(`${contactId}/`)) return { error: "Something went wrong with that upload." };
  const name = cleanName(file.name);
  if (!name || BLOCKED_EXTENSIONS.includes(extensionOf(name))) return { error: "That file type isn't allowed." };
  // make sure the file really arrived in storage
  const { error: checkError } = await c.supabase.storage.from(FILES_BUCKET).createSignedUrl(file.path, 30);
  if (checkError) return { error: `"${name}" didn't finish uploading. Please try again.` };
  if (folderId) {
    const folders = await loadFolders(c.supabase, contactId);
    if (!folders.some((f) => f.id === folderId)) return { error: "That folder no longer exists." };
  }
  const { error } = await c.supabase.from("contact_files").insert({
    contact_id: contactId, folder_id: folderId, name, storage_path: file.path, size: Math.min(file.size, MAX_FILE_BYTES),
    mime_type: file.type || null, uploaded_by: c.profile.id,
  });
  if (error) {
    await c.supabase.storage.from(FILES_BUCKET).remove([file.path]);
    return { error: error.message };
  }
  refresh(contactId); return {};
}

// ---------- Tags, and working on several items at once ----------

export async function setFileTags(contactId: string, fileId: string, rawTags: string): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const { error } = await c.supabase.from("contact_files").update({ tags: parseTags(rawTags) }).eq("id", fileId).eq("contact_id", contactId);
  if (error) return { error: error.message.includes("tags") ? "Run the new SQL for file tags in Supabase first." : error.message };
  refresh(contactId); return {};
}

type Picked = { fileIds: string[]; folderIds: string[] };

export async function moveItems(contactId: string, picked: Picked, destId: string | null): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const folders = await loadFolders(c.supabase, contactId);
  if (destId && !folders.some((f) => f.id === destId)) return { error: "That destination no longer exists." };
  // check every folder first so nothing is half-moved
  const movingFolders = picked.folderIds.map((id) => folders.find((f) => f.id === id)).filter((f): f is FolderRow => Boolean(f));
  for (const f of movingFolders) {
    if (f.parent_id === destId) continue;
    const subtree = folderSubtree(folders, f.id);
    if (destId && subtree.includes(destId)) return { error: `"${f.name}" can't be moved into itself.` };
    const deepest = Math.max(...subtree.map((id) => folderDepth(folders, id) - folderDepth(folders, f.id) + 1));
    if (folderDepth(folders, destId) + deepest > MAX_FOLDER_DEPTH) return { error: `Moving "${f.name}" would nest folders more than ${MAX_FOLDER_DEPTH} levels deep.` };
    if (folders.some((x) => x.id !== f.id && x.parent_id === destId && x.name.toLowerCase() === f.name.toLowerCase())) return { error: `A folder named "${f.name}" already exists there.` };
  }
  for (const f of movingFolders) if (f.parent_id !== destId) {
    const { error } = await c.supabase.from("contact_folders").update({ parent_id: destId }).eq("id", f.id).eq("contact_id", contactId);
    if (error) return { error: error.message };
  }
  if (picked.fileIds.length) {
    const { error } = await c.supabase.from("contact_files").update({ folder_id: destId }).in("id", picked.fileIds).eq("contact_id", contactId);
    if (error) return { error: error.message };
  }
  refresh(contactId); return {};
}

export async function deleteItems(contactId: string, picked: Picked): Promise<Result> {
  const c = await ctx(); if ("error" in c) return { error: c.error };
  const folders = await loadFolders(c.supabase, contactId);
  const folderIds = [...new Set(picked.folderIds.filter((id) => folders.some((f) => f.id === id)).flatMap((id) => folderSubtree(folders, id)))];
  const fileQuery = c.supabase.from("contact_files").select("id, storage_path").eq("contact_id", contactId);
  const { data: inFolders } = folderIds.length ? await fileQuery.in("folder_id", folderIds) : { data: [] as { id: string; storage_path: string }[] };
  const { data: direct } = picked.fileIds.length
    ? await c.supabase.from("contact_files").select("id, storage_path").eq("contact_id", contactId).in("id", picked.fileIds)
    : { data: [] as { id: string; storage_path: string }[] };
  const paths = [...new Set([...(inFolders ?? []), ...(direct ?? [])].map((f) => f.storage_path as string))];
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await c.supabase.storage.from(FILES_BUCKET).remove(paths.slice(i, i + 100));
    if (error) return { error: error.message };
  }
  if (picked.fileIds.length) await c.supabase.from("contact_files").delete().eq("contact_id", contactId).in("id", picked.fileIds);
  for (const id of picked.folderIds) if (folders.some((f) => f.id === id)) await c.supabase.from("contact_folders").delete().eq("id", id).eq("contact_id", contactId);
  refresh(contactId); return {};
}
