"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/lib/contacts";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipeline_id: string }[];
  contacts: { id: string; name: string }[];
  team: { id: string; full_name: string }[];
  isOwner: boolean;
  currentUserId: string;
  defaults: { title?: string; value?: number; contact_id?: string | null; pipeline_id: string; stage_id: string; owner_id?: string | null };
  submitLabel: string;
  cancelHref: string;
};

export default function DealForm({ action, pipelines, stages, contacts, team, isOwner, currentUserId, defaults, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [pipelineId, setPipelineId] = useState(defaults.pipeline_id);
  const stageOptions = stages.filter((s) => s.pipeline_id === pipelineId);
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <label className="block">
        <span className={label}>Deal title *</span>
        <input name="title" required defaultValue={defaults.title} placeholder="e.g. Bright Smile - website package" className="input" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Value (AUD)</span>
          <input name="value" type="number" min="0" step="1" defaultValue={defaults.value ?? 0} className="input" />
        </label>
        <label className="block">
          <span className={label}>Contact</span>
          <select name="contact_id" defaultValue={defaults.contact_id ?? ""} className="input">
            <option value="">No contact</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Pipeline</span>
          <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="input">
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Stage</span>
          <select key={pipelineId} name="stage_id" defaultValue={stageOptions.find((s) => s.id === defaults.stage_id)?.id ?? stageOptions[0]?.id} className="input">
            {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {isOwner ? (
          <label className="block">
            <span className={label}>Owner</span>
            <select name="owner_id" defaultValue={defaults.owner_id ?? currentUserId} className="input">
              {team.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </label>
        ) : (
          <label className="block"><span className={label}>Owner</span><input disabled value="You" className="input bg-slate-50" /></label>
        )}
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
