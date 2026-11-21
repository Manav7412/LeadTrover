"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { FILES_BUCKET, MAX_FILES_PER_UPLOAD, fileKind, folderPathLabel, folderSubtree, formatBytes, type FileRow, type FolderRow } from "@/lib/files";
import {
  confirmUpload, createFolder, deleteFile, deleteFolder, moveFile, moveFolder, prepareUpload, renameFile, renameFolder,
} from "@/app/(app)/contacts/[id]/file-actions";

type Props = { contactId: string; folderId: string | null; folders: FolderRow[]; files: FileRow[]; canEdit: boolean };
type Upload = { key: number; name: string; status: "uploading" | "done" | "error"; message?: string };
type Editing = { kind: "folder" | "file"; id: string; mode: "rename" | "move" } | null;

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

export default function FileManager({ contactId, folderId, folders, files, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const picker = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const here = `/contacts/${contactId}?tab=files`;
  const linkTo = (id: string | null) => (id ? `${here}&folder=${id}` : here);
  const subfolders = folders.filter((f) => f.parent_id === folderId).sort((a, b) => a.name.localeCompare(b.name));
  const inHere = files.filter((f) => f.folder_id === folderId).sort((a, b) => a.name.localeCompare(b.name));
  const crumbs: FolderRow[] = [];
  for (let cur = folders.find((f) => f.id === folderId); cur && crumbs.length < 20; cur = cur.parent_id ? folders.find((f) => f.id === cur!.parent_id) : undefined) crumbs.unshift(cur);

  const run = (job: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (res.error) setError(res.error); else { after?.(); router.refresh(); }
    });
  };

  async function uploadAll(list: FileList | File[]) {
    const picked = Array.from(list);
    if (!picked.length) return;
    setError(null);
    if (picked.length > MAX_FILES_PER_UPLOAD) setError(`Only the first ${MAX_FILES_PER_UPLOAD} files were uploaded. Upload the rest in another batch.`);
    const batch = picked.slice(0, MAX_FILES_PER_UPLOAD).map((f) => ({ f, key: ++counter.current }));
    setUploads((u) => [...u.filter((x) => x.status === "uploading"), ...batch.map(({ f, key }) => ({ key, name: f.name, status: "uploading" as const }))]);
    const storage = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage.from(FILES_BUCKET);
    const mark = (key: number, status: Upload["status"], message?: string) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, status, message } : x)));
    for (const { f, key } of batch) {
      try {
        const prep = await prepareUpload(contactId, { name: f.name, size: f.size });
        if (prep.error || !prep.path || !prep.token) { mark(key, "error", prep.error ?? "Couldn't start the upload."); continue; }
        const up = await storage.uploadToSignedUrl(prep.path, prep.token, f, { contentType: f.type || undefined });
        if (up.error) { mark(key, "error", up.error.message); continue; }
        const done = await confirmUpload(contactId, folderId, { path: prep.path, name: f.name, size: f.size, type: f.type });
        if (done.error) mark(key, "error", done.error); else mark(key, "done");
      } catch (e) { mark(key, "error", e instanceof Error ? e.message : "Upload failed."); }
    }
    router.refresh();
    setTimeout(() => setUploads((u) => u.filter((x) => x.status !== "done")), 4000);
  }

  const btn = "text-xs text-slate-500 hover:text-accent";
  const destinations = (excludeSubtreeOf?: string) => {
    const blocked = excludeSubtreeOf ? folderSubtree(folders, excludeSubtreeOf) : [];
    return folders.filter((f) => !blocked.includes(f.id)).sort((a, b) => folderPathLabel(folders, a.id).localeCompare(folderPathLabel(folders, b.id)));
  };

  function EditRow({ kind, id, current, parent }: { kind: "folder" | "file"; id: string; current: string; parent: string | null }) {
    const [value, setValue] = useState(current);
    const [dest, setDest] = useState(parent ?? "");
    const mode = editing!.mode;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {mode === "rename" ? (
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} className="input !w-64 !py-1" onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} />
        ) : (
          <select value={dest} onChange={(e) => setDest(e.target.value)} className="input !w-64 !py-1">
            <option value="">Top level</option>
            {destinations(kind === "folder" ? id : undefined).map((f) => <option key={f.id} value={f.id}>{folderPathLabel(folders, f.id)}</option>)}
          </select>
        )}
        <button
          disabled={pending} className="btn-primary !px-3 !py-1 text-xs"
          onClick={() => run(
            () => mode === "rename"
              ? (kind === "folder" ? renameFolder(contactId, id, value) : renameFile(contactId, id, value))
              : (kind === "folder" ? moveFolder(contactId, id, dest || null) : moveFile(contactId, id, dest || null)),
            () => setEditing(null),
          )}
        >Save</button>
        <button className={btn} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    );
  }

  return (
    <div
      className={`card relative overflow-hidden ${dragging ? "ring-2 ring-accent" : ""}`}
      onDragOver={(e) => { if (canEdit && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!canEdit) return; e.preventDefault(); setDragging(false); void uploadAll(e.dataTransfer.files); }}
    >
      {dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent-soft/80 text-sm font-semibold text-accent">Drop files to upload here</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
          <Link href={linkTo(null)} className={folderId ? "text-slate-500 hover:text-accent" : "font-semibold text-slate-900"}>All files</Link>
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <span className="text-slate-300">/</span>
              <Link href={linkTo(c.id)} className={i === crumbs.length - 1 ? "font-semibold text-slate-900" : "text-slate-500 hover:text-accent"}>{c.name}</Link>
            </span>
          ))}
        </nav>
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => { setCreating(true); setEditing(null); }}>+ New folder</button>
            <button className="btn-primary !py-1.5 text-xs" onClick={() => picker.current?.click()}>Upload files</button>
            <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files) void uploadAll(e.target.files); e.target.value = ""; }} />
          </div>
        )}
      </div>

      {error && <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">{error}</p>}

      {uploads.length > 0 && (
        <ul className="space-y-1 border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center justify-between gap-3">
              <span className="truncate text-slate-700">{u.name}</span>
              <span className={u.status === "error" ? "text-red-600" : u.status === "done" ? "text-emerald-600" : "text-slate-500"}>
                {u.status === "uploading" ? "Uploading…" : u.status === "done" ? "Uploaded" : u.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <form
          className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3"
          onSubmit={(e) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get("name") ?? ""); run(() => createFolder(contactId, folderId, name), () => setCreating(false)); }}
        >
          <input name="name" autoFocus required maxLength={120} placeholder="Folder name, e.g. Contracts" className="input !w-64 !py-1" onKeyDown={(e) => { if (e.key === "Escape") setCreating(false); }} />
          <button className="btn-primary !px-3 !py-1 text-xs" disabled={pending}>Create</button>
          <button type="button" className={btn} onClick={() => setCreating(false)}>Cancel</button>
        </form>
      )}

      {subfolders.length === 0 && inHere.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-sm font-medium text-slate-700">{folderId ? "This folder is empty." : "No files yet."}</p>
          <p className="mt-1 text-sm text-slate-500">{canEdit ? "Drag files here, or click Upload files. Use New folder to keep things organised." : "Nothing has been attached to this contact."}</p>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Size</th><th className="px-3 py-2.5 font-medium">Added</th><th className="px-5 py-2.5" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subfolders.map((f) => {
              const count = files.filter((x) => folderSubtree(folders, f.id).includes(x.folder_id ?? "")).length;
              const isEditing = editing?.kind === "folder" && editing.id === f.id;
              return (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    {isEditing ? <EditRow kind="folder" id={f.id} current={f.name} parent={f.parent_id} /> : (
                      <Link href={linkTo(f.id)} className="flex items-center gap-3 font-medium text-slate-900 hover:text-accent">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-amber-500" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                        {f.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{count} {count === 1 ? "file" : "files"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{dateLabel(f.created_at)}</td>
                  <td className="px-5 py-2.5">
                    {canEdit && !isEditing && (
                      <div className="flex justify-end gap-3">
                        <button className={btn} onClick={() => setEditing({ kind: "folder", id: f.id, mode: "rename" })}>Rename</button>
                        <button className={btn} onClick={() => setEditing({ kind: "folder", id: f.id, mode: "move" })}>Move</button>
                        <button className="text-xs text-slate-500 hover:text-red-600" onClick={() => { if (confirm(`Delete the folder "${f.name}" and everything inside it? This can't be undone.`)) run(() => deleteFolder(contactId, f.id)); }}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {inHere.map((f) => {
              const kind = fileKind(f.name, f.mime_type);
              const isEditing = editing?.kind === "file" && editing.id === f.id;
              return (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    {isEditing ? <EditRow kind="file" id={f.id} current={f.name} parent={f.folder_id} /> : (
                      <a href={`/files/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-slate-900 hover:text-accent">
                        <span className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${kind.style}`}>{kind.label}</span>
                        <span className="min-w-0 truncate">{f.name}</span>
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatBytes(f.size)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{dateLabel(f.created_at)}{f.profiles ? ` · ${f.profiles.full_name.split(" ")[0]}` : ""}</td>
                  <td className="px-5 py-2.5">
                    {!isEditing && (
                      <div className="flex justify-end gap-3">
                        <a href={`/files/${f.id}?download=1`} className={btn}>Download</a>
                        {canEdit && <button className={btn} onClick={() => setEditing({ kind: "file", id: f.id, mode: "rename" })}>Rename</button>}
                        {canEdit && <button className={btn} onClick={() => setEditing({ kind: "file", id: f.id, mode: "move" })}>Move</button>}
                        {canEdit && <button className="text-xs text-slate-500 hover:text-red-600" onClick={() => { if (confirm(`Delete "${f.name}"? This can't be undone.`)) run(() => deleteFile(contactId, f.id)); }}>Delete</button>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
