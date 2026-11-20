"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { CustomField } from "@/lib/objects";
import type { FormState } from "@/lib/contacts";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
const label = "mb-1 block text-sm font-medium text-slate-700";

export default function RecordForm({ action, fields, values, owners, ownerId, cancelHref }: {
  action: Action; fields: CustomField[]; values?: Record<string, unknown>;
  owners?: { id: string; full_name: string }[]; ownerId?: string | null; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {fields.map((f) => {
        const v = values?.[f.key];
        const name = `f_${f.key}`;
        if (f.type === "yesno") {
          return (
            <label key={f.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name={name} defaultChecked={v === true} className="h-4 w-4 rounded border-slate-300" /> {f.label}
            </label>
          );
        }
        return (
          <label key={f.id} className="block">
            <span className={label}>{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
            {f.type === "dropdown" ? (
              <select name={name} defaultValue={typeof v === "string" ? v : ""} required={f.required} className="input">
                <option value="">Choose…</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                name={name} required={f.required} className="input"
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                step={f.type === "number" ? "any" : undefined} maxLength={f.type === "text" ? 500 : undefined}
                defaultValue={v === undefined || v === null ? "" : String(v)}
              />
            )}
          </label>
        );
      })}
      {owners && (
        <label className="block">
          <span className={label}>Owner</span>
          <select name="owner_id" defaultValue={ownerId ?? ""} className="input">
            {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </select>
        </label>
      )}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
