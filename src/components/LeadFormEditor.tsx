"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SOURCES, type FormState } from "@/lib/contacts";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  team: { id: string; full_name: string }[];
  defaults?: {
    name?: string; slug?: string; heading?: string; description?: string | null; success_message?: string;
    default_owner_id?: string | null; tags?: string[]; source?: string; is_active?: boolean;
  };
  submitLabel: string;
};

export default function LeadFormEditor({ action, team, defaults = {}, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const label = "mb-1 block text-sm font-medium text-slate-700";
  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Form name *</span>
          <input name="name" required defaultValue={defaults.name} placeholder="e.g. Website enquiry" className="input" />
          <span className="mt-1 block text-xs text-slate-400">Only your team sees this.</span>
        </label>
        <label className="block">
          <span className={label}>Web address</span>
          <div className="flex items-center">
            <span className="rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">/f/</span>
            <input name="slug" defaultValue={defaults.slug} placeholder="contact-us" className="input !rounded-l-none" />
          </div>
          <span className="mt-1 block text-xs text-slate-400">Leave blank to use the form name.</span>
        </label>
      </div>

      <label className="block">
        <span className={label}>Heading shown to visitors</span>
        <input name="heading" defaultValue={defaults.heading ?? "Get in touch"} className="input" />
      </label>
      <label className="block">
        <span className={label}>Short description</span>
        <textarea name="description" rows={2} defaultValue={defaults.description ?? ""} placeholder="Tell us a little about what you need." className="input" />
      </label>
      <label className="block">
        <span className={label}>Message after they submit</span>
        <input name="success_message" defaultValue={defaults.success_message ?? "Thanks! We'll be in touch shortly."} className="input" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Assign new leads to</span>
          <select name="default_owner_id" defaultValue={defaults.default_owner_id ?? ""} className="input">
            <option value="">Auto-assign (fewest open leads)</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Lead source</span>
          <select name="source" defaultValue={defaults.source ?? "Website Form"} className="input">
            {[...new Set([defaults.source, ...SOURCES].filter(Boolean) as string[])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={label}>Tags to add (separate with commas)</span>
        <input name="tags" defaultValue={defaults.tags?.join(", ")} placeholder="website, new-lead" className="input" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked={defaults.is_active ?? true} className="h-4 w-4 accent-[#0b7f8c]" />
        Form is live (visitors can submit it)
      </label>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link href="/forms" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
