"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SOURCES, STATUSES, type FormState } from "@/lib/contacts";
import type { CustomField } from "@/lib/objects";
import CustomFieldInputs from "./CustomFieldInputs";

type Defaults = {
  first_name?: string; last_name?: string; email?: string | null; phone?: string | null;
  company?: string; source?: string; status?: string; tags?: string[]; owner_id?: string | null;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Defaults;
  companies: string[];
  team: { id: string; full_name: string }[];
  isOwner: boolean;
  currentUserId: string;
  submitLabel: string;
  cancelHref: string;
  autoAssign?: boolean;
  customFields?: CustomField[];
  customValues?: Record<string, unknown>;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
    {children}
  </label>
);

export default function ContactForm({ action, defaults = {}, companies, team, isOwner, currentUserId, submitLabel, cancelHref, autoAssign = false, customFields = [], customValues }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card max-w-3xl space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name *"><input name="first_name" required defaultValue={defaults.first_name} className="input" /></Field>
        <Field label="Last name"><input name="last_name" defaultValue={defaults.last_name} className="input" /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={defaults.email ?? ""} className="input" /></Field>
        <Field label="Phone"><input name="phone" defaultValue={defaults.phone ?? ""} className="input" /></Field>
        <Field label="Company">
          <input name="company" list="company-list" defaultValue={defaults.company} placeholder="Pick one or type a new company" className="input" />
          <datalist id="company-list">{companies.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Source">
          <select name="source" defaultValue={defaults.source ?? "Manual"} className="input">
            {[...new Set([defaults.source, ...SOURCES].filter(Boolean) as string[])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={defaults.status ?? "new"} className="input capitalize">
            {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </Field>
        {isOwner ? (
          <Field label="Owner">
            <select name="owner_id" defaultValue={autoAssign ? "" : defaults.owner_id ?? currentUserId} className="input">
              {autoAssign && <option value="">Auto-assign (fewest open leads)</option>}
              {team.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Owner"><input disabled value="You" className="input bg-slate-50" /></Field>
        )}
      </div>
      <Field label="Tags (separate with commas)">
        <input name="tags" defaultValue={defaults.tags?.join(", ")} placeholder="hot, follow-up" className="input" />
      </Field>
      {customFields.length > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">More details</h2>
          <CustomFieldInputs fields={customFields} values={customValues} columns />
        </div>
      )}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
