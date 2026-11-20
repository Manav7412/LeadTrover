"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/lib/contacts";
import { MERGE_FIELDS, renderTemplate, sampleValues } from "@/lib/merge";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: { name?: string; subject?: string; body?: string };
  submitLabel: string;
};

export default function TemplateEditor({ action, defaults = {}, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [subject, setSubject] = useState(defaults.subject ?? "");
  const [body, setBody] = useState(defaults.body ?? "");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");
  const label = "mb-1 block text-sm font-medium text-slate-700";
  const sample = sampleValues();

  // Puts a merge field where the cursor is, in whichever box (subject or body) was used last.
  function insert(key: string) {
    const tag = `{{${key}}}`;
    const useSubject = lastFocused.current === "subject";
    const el = useSubject ? subjectRef.current : bodyRef.current;
    const value = useSubject ? subject : body;
    const set = useSubject ? setSubject : setBody;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    set(value.slice(0, start) + tag + value.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); });
  }

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-2">
      <div className="card space-y-4 p-6">
        <label className="block">
          <span className={label}>Template name *</span>
          <input name="name" required defaultValue={defaults.name} placeholder="e.g. Proposal follow-up" className="input" />
        </label>
        <label className="block">
          <span className={label}>Subject *</span>
          <input ref={subjectRef} name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} onFocus={() => (lastFocused.current = "subject")} placeholder="Quick question, {{first_name}}" className="input" />
        </label>
        <label className="block">
          <span className={label}>Body *</span>
          <textarea ref={bodyRef} name="body" required rows={10} value={body} onChange={(e) => setBody(e.target.value)} onFocus={() => (lastFocused.current = "body")} className="input font-[inherit]" />
        </label>
        <div>
          <span className={label}>Click to insert a merge field</span>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((f) => (
              <button key={f.key} type="button" onClick={() => insert(f.key)} className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent hover:bg-accent/15" title={`Example: ${f.sample}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
          <Link href="/templates" className="btn-secondary">Cancel</Link>
        </div>
      </div>

      <div className="card h-fit p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Preview with an example contact</p>
        <p className="mt-3 border-b border-slate-100 pb-3 text-sm"><span className="text-slate-500">Subject: </span><b className="text-slate-900">{renderTemplate(subject, sample) || "…"}</b></p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{renderTemplate(body, sample) || "Start typing the email and the preview appears here."}</p>
      </div>
    </form>
  );
}
