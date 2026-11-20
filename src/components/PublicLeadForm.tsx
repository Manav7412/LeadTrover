"use client";

import { useActionState } from "react";
import { submitLead, type LeadFormState } from "@/app/f/[slug]/actions";

export default function PublicLeadForm({ slug, successMessage }: { slug: string; successMessage: string }) {
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(submitLead.bind(null, slug), undefined);
  const label = "mb-1 block text-sm font-medium text-slate-700";

  if (state?.ok) {
    return (
      <div className="py-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        </span>
        <p className="mt-4 text-lg font-semibold text-slate-900">Thank you!</p>
        <p className="mt-1 text-sm text-slate-600">{successMessage}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>First name *</span><input name="first_name" required maxLength={100} autoComplete="given-name" className="input" /></label>
        <label className="block"><span className={label}>Last name</span><input name="last_name" maxLength={100} autoComplete="family-name" className="input" /></label>
        <label className="block"><span className={label}>Email</span><input name="email" type="email" maxLength={200} autoComplete="email" className="input" /></label>
        <label className="block"><span className={label}>Phone</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" className="input" /></label>
      </div>
      <label className="block"><span className={label}>Company</span><input name="company" maxLength={200} autoComplete="organization" className="input" /></label>
      <label className="block"><span className={label}>How can we help?</span><textarea name="message" rows={4} maxLength={2000} className="input" /></label>
      {/* Honeypot: hidden from people, bots fill it in */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p className="text-xs text-slate-400">Please give us an email address or a phone number so we can reach you.</p>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full !py-2.5" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
