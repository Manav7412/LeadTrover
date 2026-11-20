"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/lib/contacts";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  contacts: { id: string; name: string }[];
  team: { id: string; full_name: string }[];
  isOwner: boolean;
  currentUserId: string;
  defaults: { title?: string; contact_id?: string | null; due_date: string; due_time: string; assigned_to?: string | null };
  submitLabel: string;
};

export default function TaskForm({ action, contacts, team, isOwner, currentUserId, defaults, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const label = "mb-1 block text-sm font-medium text-slate-700";
  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <label className="block">
        <span className={label}>What needs to happen? *</span>
        <input name="title" required defaultValue={defaults.title} placeholder="e.g. Call back about the proposal" className="input" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Due date *</span>
          <input name="due_date" type="date" required defaultValue={defaults.due_date} className="input" />
        </label>
        <label className="block">
          <span className={label}>Time</span>
          <input name="due_time" type="time" defaultValue={defaults.due_time} className="input" />
        </label>
        <label className="block">
          <span className={label}>Contact</span>
          <select name="contact_id" defaultValue={defaults.contact_id ?? ""} className="input">
            <option value="">No contact</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {isOwner ? (
          <label className="block">
            <span className={label}>Assigned to</span>
            <select name="assigned_to" defaultValue={defaults.assigned_to ?? currentUserId} className="input">
              {team.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </label>
        ) : (
          <label className="block"><span className={label}>Assigned to</span><input disabled value="You" className="input bg-slate-50" /></label>
        )}
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link href="/tasks" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
