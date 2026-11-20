"use client";

import { useState } from "react";
import type { FormState } from "@/lib/contacts";

// Delete button with an "are you sure?" and a place to show why a delete was refused.
export default function DeletePipelineButton({ action, name }: { action: () => Promise<FormState>; name: string }) {
  const [error, setError] = useState("");
  return (
    <form
      action={async () => {
        if (!confirm(`Delete the "${name}" pipeline and its stages? This can't be undone.`)) return;
        const res = await action();
        if (res?.error) setError(res.error);
      }}
      className="text-right"
    >
      <button className="btn-secondary !text-red-600 hover:!bg-red-50">Delete pipeline</button>
      {error && <p className="mt-2 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-left text-xs text-red-700">{error}</p>}
    </form>
  );
}
