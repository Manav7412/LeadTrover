"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ACTIVITY_TYPES, OUTCOMES, TYPE_ICON, TYPE_LABEL, type ActivityType } from "@/lib/activities";
import { logActivity } from "@/app/(app)/contacts/[id]/activity-actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Log activity"}</button>;
}

export default function ActivityForm({ contactId, deals, defaultFollowUp }: { contactId: string; deals: { id: string; title: string }[]; defaultFollowUp: string }) {
  const [type, setType] = useState<ActivityType>("call");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(formData: FormData) {
    setError(""); setSaved("");
    const res = await logActivity(contactId, formData);
    if (res.error) { setError(res.error); return; }
    formRef.current?.reset();
    setType("call");
    setSaved(res.taskDue ? `Activity logged. Follow-up task created for ${res.taskDue}.` : "Activity logged.");
  }

  return (
    <form ref={formRef} action={submit} className="card space-y-4 p-5">
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              type === t ? "border-accent bg-accent-soft text-accent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={TYPE_ICON[t]} /></svg>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {OUTCOMES[type].length > 0 && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Outcome</span>
            <select name="outcome" key={type} defaultValue="" className="input">
              <option value="">Choose…</option>
              {OUTCOMES[type].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
        )}
        {deals.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Related deal</span>
            <select name="deal_id" defaultValue="" className="input">
              <option value="">None</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
        <textarea name="notes" rows={3} placeholder="What was discussed?" className="input" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Next step</span>
          <input name="next_step" placeholder="e.g. Send proposal" className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Follow up on</span>
          <input name="follow_up_date" type="date" defaultValue={defaultFollowUp} className="input" />
        </label>
      </div>
      <p className="-mt-2 text-xs text-slate-400">If you add a next step, LeadTrove creates a follow-up task for that date.</p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saved}</p>}
      <Submit />
    </form>
  );
}
