"use client";

import { useState } from "react";

// Shows a form's public link with a Copy button.
export default function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const full = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return (
    <div className="flex items-center gap-2">
      <code className="truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700" suppressHydrationWarning>{full}</code>
      <button
        type="button"
        className="shrink-0 text-xs font-medium text-accent hover:underline"
        onClick={async () => {
          try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
