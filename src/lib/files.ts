// Contact files and folders (the "Files" tab on a contact). Rules shared by the server actions and the screen.

export const FILES_BUCKET = "contact-files";
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB, also enforced by the storage bucket
export const MAX_FOLDER_DEPTH = 6;
export const MAX_NAME_LENGTH = 120;
export const MAX_FILES_PER_UPLOAD = 20;

// Programs and scripts are not accepted.
export const BLOCKED_EXTENSIONS = ["exe", "bat", "cmd", "com", "msi", "scr", "sh", "ps1", "vbs", "js", "jar", "app", "dmg", "apk"];

export type FolderRow = { id: string; contact_id: string; parent_id: string | null; name: string; created_at: string };
export type FileRow = {
  id: string; contact_id: string; folder_id: string | null; name: string; size: number; mime_type: string | null;
  created_at: string; profiles: { full_name: string } | null;
};

export const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

// A safe file name to use inside the storage path (the real name is kept in the database).
export const safeStorageName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// A short label and colour for the file type badge.
export function fileKind(name: string, mime: string | null): { label: string; style: string } {
  const ext = extensionOf(name);
  const m = mime ?? "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { label: "IMG", style: "bg-violet-50 text-violet-700" };
  if (ext === "pdf" || m === "application/pdf") return { label: "PDF", style: "bg-red-50 text-red-700" };
  if (["doc", "docx", "rtf", "txt", "odt", "md"].includes(ext)) return { label: "DOC", style: "bg-sky-50 text-sky-700" };
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return { label: "XLS", style: "bg-emerald-50 text-emerald-700" };
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return { label: "PPT", style: "bg-orange-50 text-orange-700" };
  if (["zip", "rar", "7z", "gz"].includes(ext)) return { label: "ZIP", style: "bg-amber-50 text-amber-700" };
  return { label: ext ? ext.slice(0, 4).toUpperCase() : "FILE", style: "bg-slate-100 text-slate-600" };
}

// "Proposals / 2026 / Signed", for the folder picker.
export function folderPathLabel(folders: FolderRow[], id: string | null): string {
  const names: string[] = [];
  let cur = id ? folders.find((f) => f.id === id) : undefined;
  for (let i = 0; cur && i < 20; i++) { names.unshift(cur.name); cur = cur.parent_id ? folders.find((f) => f.id === cur!.parent_id) : undefined; }
  return names.length ? names.join(" / ") : "Top level";
}

// A folder and everything inside it (ids), used for deleting and for blocking "move into itself".
export function folderSubtree(folders: FolderRow[], rootId: string): string[] {
  const out = [rootId];
  for (let i = 0; i < out.length && out.length < 5000; i++) for (const f of folders) if (f.parent_id === out[i] && !out.includes(f.id)) out.push(f.id);
  return out;
}

export function folderDepth(folders: FolderRow[], id: string | null): number {
  let depth = 0; let cur = id ? folders.find((f) => f.id === id) : undefined;
  while (cur && depth < 50) { depth++; cur = cur.parent_id ? folders.find((f) => f.id === cur!.parent_id) : undefined; }
  return depth;
}
