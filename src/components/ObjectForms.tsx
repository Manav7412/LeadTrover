"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FIELD_TYPES } from "@/lib/objects";
import type { MessageState } from "@/lib/contacts";

type Action = (prev: MessageState, formData: FormData) => Promise<MessageState>;
const label = "mb-1 block text-sm font-medium text-slate-700";

function Notice({ state }: { state: MessageState }) {
  if (state?.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function ObjectForm({ action, defaults, submitLabel }: {
  action: Action; submitLabel: string; defaults?: { name: string; plural: string; description: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Name (one)</span>
          <input name="name" required maxLength={40} defaultValue={defaults?.name} placeholder="e.g. Property" className="input" />
        </label>
        <label className="block">
          <span className={label}>Name (many)</span>
          <input name="plural" maxLength={40} defaultValue={defaults?.plural} placeholder="e.g. Properties" className="input" />
        </label>
      </div>
      <label className="block">
        <span className={label}>What is it for? <span className="font-normal text-slate-400">(optional)</span></span>
        <input name="description" maxLength={200} defaultValue={defaults?.description ?? ""} placeholder="e.g. Homes we are helping clients sell" className="input" />
      </label>
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

export function EditFieldForm({ action, field, cancelHref }: {
  action: Action; cancelHref: string;
  field: { label: string; type: string; options: string[]; required: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const typeName = FIELD_TYPES.find((t) => t.key === field.type)?.label ?? field.type;
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Field name</span>
          <input name="label" required maxLength={60} defaultValue={field.label} className="input" />
        </label>
        <label className="block">
          <span className={label}>Type</span>
          <input disabled value={typeName} className="input bg-slate-50" />
          <span className="mt-1 block text-xs text-slate-400">The type can&apos;t be changed after the field is created.</span>
        </label>
      </div>
      {field.type === "dropdown" && (
        <label className="block">
          <span className={label}>Choices <span className="font-normal text-slate-400">(separate with commas)</span></span>
          <input name="options" defaultValue={field.options.join(", ")} className="input" />
        </label>
      )}
      {field.type !== "yesno" && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="required" defaultChecked={field.required} className="h-4 w-4 rounded border-slate-300" /> Required
        </label>
      )}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}

export function FieldForm({ action }: { action: Action }) {
  const [type, setType] = useState("text");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Field name</span>
          <input name="label" required maxLength={60} placeholder="e.g. Address" className="input" />
        </label>
        <label className="block">
          <span className={label}>Type</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            {FIELD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
      </div>
      {type === "dropdown" && (
        <label className="block">
          <span className={label}>Choices <span className="font-normal text-slate-400">(separate with commas)</span></span>
          <input name="options" placeholder="e.g. Listed, Under offer, Sold" className="input" />
        </label>
      )}
      {type !== "yesno" && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="required" className="h-4 w-4 rounded border-slate-300" /> Required
        </label>
      )}
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add field"}</button>
    </form>
  );
}
