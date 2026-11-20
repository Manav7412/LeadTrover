"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/lib/contacts";
import { emptyFields, renderTemplate, type MergeValues } from "@/lib/merge";

type Template = { id: string; name: string; subject: string; body: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  templates: Template[];
  values: MergeValues;
  toEmail: string | null;
  contactName: string;
  defaultFollowUp: string;
  cancelHref: string;
};

export default function EmailComposer({ action, templates, values, toEmail, contactName, defaultFollowUp, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const label = "mb-1 block text-sm font-medium text-slate-700";
  const template = templates.find((t) => t.id === templateId);
  const missing = template ? emptyFields(`${template.subject} ${template.body}`, values) : [];

  function choose(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(renderTemplate(t.subject, values)); setBody(renderTemplate(t.body, values)); }
  }

  return (
    <form action={formAction} className="card max-w-3xl space-y-4 p-6">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <b>Demo mode:</b> this logs the email on {contactName}&apos;s timeline. It isn&apos;t actually sent yet. Real sending comes later.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>To</span>
          <input disabled value={toEmail ?? "No email address on file"} className="input bg-slate-50" />
        </label>
        <label className="block">
          <span className={label}>Template</span>
          <select value={templateId} onChange={(e) => choose(e.target.value)} className="input">
            <option value="">Write from scratch</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>

      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {contactName} has no {missing.map((m) => m.replace("_", " ")).join(", ")} on file, so {missing.length > 1 ? "those fields were" : "that field was"} left blank. Check the text below.
        </p>
      )}

      <label className="block">
        <span className={label}>Subject *</span>
        <input name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
      </label>
      <label className="block">
        <span className={label}>Message *</span>
        <textarea name="body" required rows={12} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className={label}>Next step</span>
          <input name="next_step" placeholder="e.g. Call to follow up" className="input" />
        </label>
        <label className="block">
          <span className={label}>Follow up on</span>
          <input name="follow_up_date" type="date" defaultValue={defaultFollowUp} className="input" />
        </label>
      </div>
      <p className="-mt-2 text-xs text-slate-400">If you add a next step, LeadTrove creates a follow-up task for that date.</p>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Logging…" : "Log email on timeline"}</button>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => { try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }}
        >
          {copied ? "Copied!" : "Copy email text"}
        </button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
