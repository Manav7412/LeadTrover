"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { zipSync } from "fflate";
import {
  FILES_BUCKET, MAX_FILES_PER_UPLOAD, MAX_ZIP_BYTES, TAG_SUGGESTIONS, extensionOf, fileKind, folderPathLabel, folderSubtree, formatBytes,
  type FileRow, type FolderRow,
} from "@/lib/files";
import {
  confirmUpload, createFolder, deleteItems, moveItems, prepareUpload, renameFile, renameFolder, setFileTags,
} from "@/app/(app)/contacts/[id]/file-actions";

type Props = { contactId: string; zipName: string; folderId: string | null; folders: FolderRow[]; files: FileRow[]; canEdit: boolean };
type Upload = { key: number; name: string; status: "uploading" | "done" | "error"; message?: string };
type Mode = "rename" | "move" | "tags";
type Editing = { kind: "folder" | "file"; id: string; mode: Mode } | null;
type Run = (job: () => Promise<{ error?: string }>, after?: () => void) => void;
type SortKey = "name" | "date" | "size";

const DND_TYPE = "application/x-leadtrove-items";
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | null;
function previewKind(name: string, mime: string | null): PreviewKind {
  const ext = extensionOf(name); const m = mime ?? "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  if (m.startsWith("text/") || ["txt", "csv", "md", "json", "log"].includes(ext)) return "text";
  return null;
}

// The preview window: shows the file on top of the contact page, so nothing downloads and no new tab opens.
function Preview({ files, index, onClose, onGo }: { files: FileRow[]; index: number; onClose: () => void; onGo: (i: number) => void }) {
  const file = files[index];
  const kind = previewKind(file.name, file.mime_type);
  const src = `/files/${file.id}`;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onGo(index - 1);
      else if (e.key === "ArrowRight" && index < files.length - 1) onGo(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [index, files.length, onClose, onGo]);

  const nav = "flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`}>
      <div className="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <button className={nav} disabled={index === 0} onClick={() => onGo(index - 1)} aria-label="Previous file">‹</button>
          <button className={nav} disabled={index === files.length - 1} onClick={() => onGo(index + 1)} aria-label="Next file">›</button>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)} · {index + 1} of {files.length}</p>
          </div>
          <a href={`${src}?download=1`} className="btn-secondary !py-1.5 text-xs">Download</a>
          <a href={src} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 text-xs">Open in new tab</a>
          <button className={nav} onClick={onClose} aria-label="Close preview">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="relative flex-1 bg-slate-100">
          {kind && !loaded && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Loading…</p>}
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={file.id} src={src} alt={file.name} onLoad={() => setLoaded(true)} className="absolute inset-0 h-full w-full object-contain p-4" />
          )}
          {(kind === "pdf" || kind === "text") && <iframe key={file.id} src={src} title={file.name} onLoad={() => setLoaded(true)} className="absolute inset-0 h-full w-full bg-white" />}
          {kind === "video" && <video key={file.id} src={src} controls onLoadedData={() => setLoaded(true)} className="absolute inset-0 h-full w-full bg-black" />}
          {kind === "audio" && <div className="absolute inset-0 flex items-center justify-center p-8"><audio key={file.id} src={src} controls onLoadedData={() => setLoaded(true)} className="w-full max-w-md" /></div>}
          {!kind && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <span className={`flex h-14 w-16 items-center justify-center rounded-xl text-sm font-bold ${fileKind(file.name, file.mime_type).style}`}>{fileKind(file.name, file.mime_type).label}</span>
              <p className="text-sm font-medium text-slate-700">This type of file can&apos;t be previewed here.</p>
              <p className="text-sm text-slate-500">Word, Excel and PowerPoint files need to be downloaded to open them.</p>
              <a href={`${src}?download=1`} className="btn-primary">Download {file.name.length > 30 ? "file" : file.name}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// The small form that appears in a row for Rename, Move and Tags.
function EditRow({ kind, id, mode, current, parent, contactId, folders, pending, run, onDone }: {
  kind: "folder" | "file"; id: string; mode: Mode; current: string; parent: string | null;
  contactId: string; folders: FolderRow[]; pending: boolean; run: Run; onDone: () => void;
}) {
  const [value, setValue] = useState(current);
  const [dest, setDest] = useState(parent ?? "");
  const blocked = kind === "folder" ? folderSubtree(folders, id) : [];
  const options = folders.filter((f) => !blocked.includes(f.id)).sort((a, b) => folderPathLabel(folders, a.id).localeCompare(folderPathLabel(folders, b.id)));
  const save = () => run(
    () => mode === "rename" ? (kind === "folder" ? renameFolder(contactId, id, value) : renameFile(contactId, id, value))
      : mode === "tags" ? setFileTags(contactId, id, value)
      : moveItems(contactId, { fileIds: kind === "file" ? [id] : [], folderIds: kind === "folder" ? [id] : [] }, dest || null),
    onDone,
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "move" ? (
        <select value={dest} onChange={(e) => setDest(e.target.value)} className="input !w-64 !py-1">
          <option value="">Top level</option>
          {options.map((f) => <option key={f.id} value={f.id}>{folderPathLabel(folders, f.id)}</option>)}
        </select>
      ) : (
        <>
          <input
            autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={mode === "tags" ? 120 : 120} list={mode === "tags" ? "tag-suggestions" : undefined}
            placeholder={mode === "tags" ? "e.g. Contract, Signed (separate with commas)" : undefined} className="input !w-72 !py-1"
            onKeyDown={(e) => { if (e.key === "Escape") onDone(); if (e.key === "Enter") save(); }}
          />
          {mode === "tags" && <datalist id="tag-suggestions">{TAG_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>}
        </>
      )}
      <button disabled={pending} className="btn-primary !px-3 !py-1 text-xs" onClick={save}>Save</button>
      <button className="text-xs text-slate-500 hover:text-accent" onClick={onDone}>Cancel</button>
    </div>
  );
}

export default function FileManager({ contactId, zipName, folderId, folders, files, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set()); // "f:<file id>" or "d:<folder id>"
  const [dropOver, setDropOver] = useState<string | null>(null);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const [bulkDest, setBulkDest] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const here = `/contacts/${contactId}?tab=files`;
  const linkTo = (id: string | null) => (id ? `${here}&folder=${id}` : here);

  // ----- what to show: this folder, or search results across every folder -----
  const q = query.trim().toLowerCase();
  const searching = q !== "" || tagFilter !== null;
  const folderMatches = (f: FolderRow) => f.name.toLowerCase().includes(q);
  const fileMatches = (f: FileRow) => (!q || f.name.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q))) && (!tagFilter || f.tags.includes(tagFilter));
  const baseFolders = searching ? (tagFilter ? [] : folders.filter(folderMatches)) : folders.filter((f) => f.parent_id === folderId);
  const baseFiles = searching ? files.filter(fileMatches) : files.filter((f) => f.folder_id === folderId);
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  const shownFolders = [...baseFolders].sort((a, b) => sort.key === "date" ? sort.dir * (a.created_at < b.created_at ? -1 : 1) : sort.key === "name" ? sort.dir * byName(a.name, b.name) : byName(a.name, b.name));
  const shownFiles = [...baseFiles].sort((a, b) => sort.key === "size" ? sort.dir * (a.size - b.size) : sort.key === "date" ? sort.dir * (a.created_at < b.created_at ? -1 : 1) : sort.dir * byName(a.name, b.name));
  const allTags = [...new Set(files.flatMap((f) => f.tags))].sort((a, b) => a.localeCompare(b));
  const crumbs: FolderRow[] = [];
  for (let cur = folders.find((f) => f.id === folderId); cur && crumbs.length < 20; cur = cur.parent_id ? folders.find((f) => f.id === cur!.parent_id) : undefined) crumbs.unshift(cur);

  const visibleKeys = [...shownFolders.map((f) => `d:${f.id}`), ...shownFiles.map((f) => `f:${f.id}`)];
  const picked = visibleKeys.filter((k) => selected.has(k));
  const pickedFiles = picked.filter((k) => k.startsWith("f:")).map((k) => k.slice(2));
  const pickedFolders = picked.filter((k) => k.startsWith("d:")).map((k) => k.slice(2));
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const allPicked = visibleKeys.length > 0 && picked.length === visibleKeys.length;

  const run: Run = (job, after) => {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (res.error) setError(res.error); else { after?.(); router.refresh(); }
    });
  };

  // ----- uploading -----
  async function uploadAll(list: FileList | File[]) {
    const chosen = Array.from(list);
    if (!chosen.length) return;
    setError(null);
    if (chosen.length > MAX_FILES_PER_UPLOAD) setError(`Only the first ${MAX_FILES_PER_UPLOAD} files were uploaded. Upload the rest in another batch.`);
    const batch = chosen.slice(0, MAX_FILES_PER_UPLOAD).map((f) => ({ f, key: ++counter.current }));
    setUploads((u) => [...u.filter((x) => x.status === "uploading"), ...batch.map(({ f, key }) => ({ key, name: f.name, status: "uploading" as const }))]);
    const storage = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage.from(FILES_BUCKET);
    const mark = (key: number, status: Upload["status"], message?: string) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, status, message } : x)));
    for (const { f, key } of batch) {
      try {
        const prep = await prepareUpload(contactId, { name: f.name, size: f.size });
        if (prep.error || !prep.path || !prep.token) { mark(key, "error", prep.error ?? "Couldn't start the upload."); continue; }
        const up = await storage.uploadToSignedUrl(prep.path, prep.token, f, { contentType: f.type || undefined });
        if (up.error) { mark(key, "error", up.error.message); continue; }
        const done = await confirmUpload(contactId, searching ? null : folderId, { path: prep.path, name: f.name, size: f.size, type: f.type });
        if (done.error) mark(key, "error", done.error); else mark(key, "done");
      } catch (e) { mark(key, "error", e instanceof Error ? e.message : "Upload failed."); }
    }
    router.refresh();
    setTimeout(() => setUploads((u) => u.filter((x) => x.status !== "done")), 4000);
  }

  // ----- ZIP download (built in the browser) -----
  async function downloadZip(fileIds: string[], folderIds: string[], label: string) {
    setError(null);
    const entries: { path: string; file: FileRow }[] = [];
    const used = new Set<string>();
    const add = (path: string, file: FileRow) => {
      let p = path; let n = 1;
      while (used.has(p.toLowerCase())) { n++; const dot = path.lastIndexOf("."); p = dot > path.lastIndexOf("/") + 1 ? `${path.slice(0, dot)} (${n})${path.slice(dot)}` : `${path} (${n})`; }
      used.add(p.toLowerCase()); entries.push({ path: p, file });
    };
    const relPath = (fid: string, rootId: string) => { const names: string[] = []; for (let cur = folders.find((f) => f.id === fid); cur; cur = cur.id === rootId ? undefined : folders.find((f) => f.id === cur!.parent_id)) names.unshift(cur.name); return names.join("/"); };
    for (const id of fileIds) { const f = files.find((x) => x.id === id); if (f) add(f.name, f); }
    for (const rootId of folderIds) {
      const sub = folderSubtree(folders, rootId);
      for (const f of files) if (f.folder_id && sub.includes(f.folder_id)) add(`${relPath(f.folder_id, rootId)}/${f.name}`, f);
    }
    if (!entries.length) { setError("There are no files to download there."); return; }
    if (entries.reduce((s, e) => s + e.file.size, 0) > MAX_ZIP_BYTES) { setError(`That's more than ${MAX_ZIP_BYTES / 1024 / 1024} MB. Download it in smaller parts.`); return; }
    try {
      const data: Record<string, [Uint8Array, { level: 0 }]> = {};
      for (const [i, e] of entries.entries()) {
        setZipStatus(`Preparing ZIP… ${i + 1} of ${entries.length}`);
        const res = await fetch(`/files/${e.file.id}`);
        if (!res.ok) throw new Error(`Couldn't read "${e.file.name}".`);
        data[e.path] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }];
      }
      const blob = new Blob([zipSync(data) as BlobPart], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${(label || zipName || "files").replace(/[\\/:*?"<>|]+/g, "_")}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't build the ZIP."); }
    setZipStatus(null);
  }

  // ----- drag a row onto a folder (or the path bar) to move it -----
  const moveKeys = (keys: string[], destId: string | null) => {
    const fileIds = keys.filter((k) => k.startsWith("f:")).map((k) => k.slice(2));
    const folderIds = keys.filter((k) => k.startsWith("d:")).map((k) => k.slice(2)).filter((id) => id !== destId);
    if (!fileIds.length && !folderIds.length) return;
    run(() => moveItems(contactId, { fileIds, folderIds }, destId), () => setSelected(new Set()));
  };
  const dropProps = (destId: string | null, tag: string) => canEdit ? {
    onDragOver: (e: React.DragEvent) => { if (Array.from(e.dataTransfer.types).includes(DND_TYPE)) { e.preventDefault(); e.stopPropagation(); setDropOver(tag); } },
    onDragLeave: () => setDropOver((o) => (o === tag ? null : o)),
    onDrop: (e: React.DragEvent) => { const raw = e.dataTransfer.getData(DND_TYPE); if (!raw) return; e.preventDefault(); e.stopPropagation(); setDropOver(null); try { moveKeys(JSON.parse(raw) as string[], destId); } catch { /* ignore */ } },
  } : {};
  const dragProps = (key: string, off: boolean) => canEdit && !off ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { const keys = selected.has(key) && picked.length > 1 ? picked : [key]; e.dataTransfer.setData(DND_TYPE, JSON.stringify(keys)); e.dataTransfer.effectAllowed = "move"; },
  } : {};

  const btn = "text-xs text-slate-500 hover:text-accent";
  // a small "More" menu so the row stays tidy
  const more = (items: { label: string; onClick: () => void; danger?: boolean }[]) => (
    <details className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.removeAttribute("open"); }}>
      <summary className="cursor-pointer list-none text-xs text-slate-500 hover:text-accent [&::-webkit-details-marker]:hidden">More ▾</summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
        {items.map((it) => (
          <button key={it.label} className={`block w-full px-3 py-1.5 text-left text-xs ${it.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
            onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); it.onClick(); }}>{it.label}</button>
        ))}
      </div>
    </details>
  );
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");
  const th = "px-3 py-2.5 font-medium";
  const folderTargets = folders.slice().sort((a, b) => folderPathLabel(folders, a.id).localeCompare(folderPathLabel(folders, b.id)));
  const editRow = (kind: "folder" | "file", id: string, mode: Mode, current: string, parent: string | null) => (
    <EditRow key={`${kind}${id}${mode}`} kind={kind} id={id} mode={mode} current={current} parent={parent} contactId={contactId} folders={folders} pending={pending} run={run} onDone={() => setEditing(null)} />
  );

  return (
    <div
      className={`card relative ${dragging ? "ring-2 ring-accent" : ""}`}
      onDragOver={(e) => { if (canEdit && Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!canEdit || !Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); setDragging(false); void uploadAll(e.dataTransfer.files); }}
    >
      {dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent-soft/80 text-sm font-semibold text-accent">Drop files to upload here</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
          <Link href={linkTo(null)} {...dropProps(null, "root")} className={`rounded px-1 ${dropOver === "root" ? "bg-accent-soft text-accent" : ""} ${folderId ? "text-slate-500 hover:text-accent" : "font-semibold text-slate-900"}`}>All files</Link>
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <span className="text-slate-300">/</span>
              <Link href={linkTo(c.id)} {...dropProps(c.id, c.id)} className={`rounded px-1 ${dropOver === c.id ? "bg-accent-soft text-accent" : ""} ${i === crumbs.length - 1 ? "font-semibold text-slate-900" : "text-slate-500 hover:text-accent"}`}>{c.name}</Link>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files and tags" aria-label="Search files" className="input !w-48 !py-1.5 !pl-8 text-xs" />
          </div>
          {folderId && !searching && folders.length > 0 && <button className="btn-secondary !py-1.5 text-xs" onClick={() => void downloadZip([], [folderId], crumbs[crumbs.length - 1]?.name ?? zipName)} title="Download this folder as a ZIP">ZIP</button>}
          {canEdit && (
            <>
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => { setCreating(true); setEditing(null); }}>+ New folder</button>
              <button className="btn-primary !py-1.5 text-xs" onClick={() => picker.current?.click()}>Upload files</button>
              <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files) void uploadAll(e.target.files); e.target.value = ""; }} />
            </>
          )}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-5 py-2 text-xs">
          <span className="text-slate-400">Tags:</span>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter((cur) => (cur === t ? null : t))} className={`rounded-full px-2.5 py-0.5 font-medium ${tagFilter === t ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
          ))}
          {tagFilter && <button onClick={() => setTagFilter(null)} className="text-slate-400 hover:text-accent">Clear</button>}
        </div>
      )}

      {error && <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">{error}</p>}
      {zipStatus && <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-sm text-slate-600">{zipStatus}</p>}

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

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-accent/20 bg-accent-soft/60 px-5 py-2 text-sm">
          <span className="font-medium text-slate-800">{picked.length} selected</span>
          <button className="btn-secondary !py-1 text-xs" onClick={() => void downloadZip(pickedFiles, pickedFolders, zipName)}>Download ZIP</button>
          {canEdit && (
            <>
              <select value={bulkDest} onChange={(e) => setBulkDest(e.target.value)} className="input !w-52 !py-1 text-xs" aria-label="Move to">
                <option value="">Move to top level</option>
                {folderTargets.filter((f) => !pickedFolders.some((id) => folderSubtree(folders, id).includes(f.id))).map((f) => <option key={f.id} value={f.id}>{folderPathLabel(folders, f.id)}</option>)}
              </select>
              <button className="btn-secondary !py-1 text-xs" disabled={pending} onClick={() => run(() => moveItems(contactId, { fileIds: pickedFiles, folderIds: pickedFolders }, bulkDest || null), () => setSelected(new Set()))}>Move</button>
              <button className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50" disabled={pending} onClick={() => { if (confirm(`Delete ${picked.length} selected ${picked.length === 1 ? "item" : "items"}${pickedFolders.length ? ", including everything inside the selected folders" : ""}? This can't be undone.`)) run(() => deleteItems(contactId, { fileIds: pickedFiles, folderIds: pickedFolders }), () => setSelected(new Set())); }}>Delete</button>
            </>
          )}
          <button className="ml-auto text-xs text-slate-500 hover:text-accent" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {shownFolders.length === 0 && shownFiles.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-sm font-medium text-slate-700">{searching ? "Nothing matches that search." : folderId ? "This folder is empty." : "No files yet."}</p>
          <p className="mt-1 text-sm text-slate-500">{searching ? "Try a different word, or clear the tag filter." : canEdit ? "Drag files here, or click Upload files. Use New folder to keep things organised." : "Nothing has been attached to this contact."}</p>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 py-2.5 pl-5"><input type="checkbox" aria-label="Select all" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(visibleKeys))} className="h-4 w-4 rounded border-slate-300" /></th>
              <th className={th}><button onClick={() => sortBy("name")} className="uppercase tracking-wide hover:text-slate-900">Name{arrow("name")}</button></th>
              <th className={th}><button onClick={() => sortBy("size")} className="uppercase tracking-wide hover:text-slate-900">Size{arrow("size")}</button></th>
              <th className={th}><button onClick={() => sortBy("date")} className="uppercase tracking-wide hover:text-slate-900">Added{arrow("date")}</button></th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shownFolders.map((f) => {
              const key = `d:${f.id}`;
              const count = files.filter((x) => folderSubtree(folders, f.id).includes(x.folder_id ?? "")).length;
              const isEditing = editing?.kind === "folder" && editing.id === f.id;
              return (
                <tr key={f.id} {...dragProps(key, isEditing)} {...dropProps(f.id, f.id)} className={`${dropOver === f.id ? "bg-accent-soft" : selected.has(key) ? "bg-accent-soft/40" : "hover:bg-slate-50"}`}>
                  <td className="py-2.5 pl-5"><input type="checkbox" aria-label={`Select ${f.name}`} checked={selected.has(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded border-slate-300" /></td>
                  <td className="px-3 py-2.5">
                    {isEditing ? editRow("folder", f.id, editing.mode, f.name, f.parent_id) : (
                      <div>
                        <Link href={linkTo(f.id)} onClick={() => { setQuery(""); setTagFilter(null); }} className="flex items-center gap-3 font-medium text-slate-900 hover:text-accent">
                          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-amber-500" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                          {f.name}
                        </Link>
                        {searching && f.parent_id && <p className="ml-8 text-xs text-slate-400">in {folderPathLabel(folders, f.parent_id)}</p>}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{count} {count === 1 ? "file" : "files"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{dateLabel(f.created_at)}</td>
                  <td className="px-5 py-2.5">
                    {!isEditing && (
                      <div className="flex justify-end gap-3">
                        <button className={btn} onClick={() => void downloadZip([], [f.id], f.name)}>Download ZIP</button>
                        {canEdit && more([
                          { label: "Rename", onClick: () => setEditing({ kind: "folder", id: f.id, mode: "rename" }) },
                          { label: "Move", onClick: () => setEditing({ kind: "folder", id: f.id, mode: "move" }) },
                          { label: "Delete", danger: true, onClick: () => { if (confirm(`Delete the folder "${f.name}" and everything inside it? This can't be undone.`)) run(() => deleteItems(contactId, { fileIds: [], folderIds: [f.id] })); } },
                        ])}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {shownFiles.map((f) => {
              const key = `f:${f.id}`;
              const kind = fileKind(f.name, f.mime_type);
              const isEditing = editing?.kind === "file" && editing.id === f.id;
              return (
                <tr key={f.id} {...dragProps(key, isEditing)} className={selected.has(key) ? "bg-accent-soft/40" : "hover:bg-slate-50"}>
                  <td className="py-2.5 pl-5"><input type="checkbox" aria-label={`Select ${f.name}`} checked={selected.has(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded border-slate-300" /></td>
                  <td className="px-3 py-2.5">
                    {isEditing ? editRow("file", f.id, editing.mode, editing.mode === "tags" ? f.tags.join(", ") : f.name, f.folder_id) : (
                      <div>
                        <button onClick={() => setPreviewId(f.id)} className="flex max-w-full items-center gap-3 text-left text-slate-900 hover:text-accent" title="Preview">
                          <span className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${kind.style}`}>{kind.label}</span>
                          <span className="min-w-0 truncate">{f.name}</span>
                        </button>
                        {(f.tags.length > 0 || (searching && f.folder_id)) && (
                          <div className="ml-12 mt-1 flex flex-wrap items-center gap-1">
                            {f.tags.map((t) => <button key={t} onClick={() => setTagFilter(t)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200">{t}</button>)}
                            {searching && f.folder_id && <Link href={linkTo(f.folder_id)} onClick={() => { setQuery(""); setTagFilter(null); }} className="text-xs text-slate-400 hover:text-accent">in {folderPathLabel(folders, f.folder_id)}</Link>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatBytes(f.size)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{dateLabel(f.created_at)}{f.profiles ? ` · ${f.profiles.full_name.split(" ")[0]}` : ""}</td>
                  <td className="px-5 py-2.5">
                    {!isEditing && (
                      <div className="flex justify-end gap-3">
                        <button className={btn} onClick={() => setPreviewId(f.id)}>Preview</button>
                        <a href={`/files/${f.id}?download=1`} className={btn}>Download</a>
                        {canEdit && more([
                          { label: "Tags", onClick: () => setEditing({ kind: "file", id: f.id, mode: "tags" }) },
                          { label: "Rename", onClick: () => setEditing({ kind: "file", id: f.id, mode: "rename" }) },
                          { label: "Move", onClick: () => setEditing({ kind: "file", id: f.id, mode: "move" }) },
                          { label: "Delete", danger: true, onClick: () => { if (confirm(`Delete "${f.name}"? This can't be undone.`)) run(() => deleteItems(contactId, { fileIds: [f.id], folderIds: [] })); } },
                        ])}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {canEdit && shownFiles.length + shownFolders.length > 1 && <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">Tip: drag a file or folder onto another folder, or onto the path above, to move it.</p>}

      {previewId && shownFiles.some((f) => f.id === previewId) && (
        <Preview key={previewId} files={shownFiles} index={shownFiles.findIndex((f) => f.id === previewId)} onClose={() => setPreviewId(null)} onGo={(i) => setPreviewId(shownFiles[i].id)} />
      )}
    </div>
  );
}
