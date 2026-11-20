import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { TZ } from "@/lib/dates";
import { can } from "@/lib/permissions";

const AUTOMATIONS = [
  { name: "New lead gets an owner", text: "A lead with no owner goes to the team member with the fewest open leads. This applies to forms, imports and manually added contacts." },
  { name: "Deal won creates an onboarding deal", text: "Moving a Sales deal to Won creates a matching deal in Client Onboarding (Signed) and a task to book the kickoff call." },
  { name: "Stale lead flag", text: "A lead with no activity for 7 days is flagged Stale. Logging any activity clears the flag. Customers and lost contacts are never flagged." },
  { name: "Next step becomes a task", text: "Logging an activity or email with a next step creates a follow-up task for the contact's owner." },
];

export default async function WorkspaceSettingsPage() {
  const { profile } = await requireProfile();
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Automations</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">These run automatically in the background.</p>
        <ul className="space-y-3">
          {AUTOMATIONS.map((a) => (
            <li key={a.name} className="flex items-start gap-3 rounded-lg border border-slate-100 p-4">
              <span className="mt-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">On</span>
              <div>
                <p className="text-sm font-medium text-slate-900">{a.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Basics</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Time zone (for Today and Overdue)</dt><dd className="text-slate-900">{TZ}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Currency</dt><dd className="text-slate-900">Australian dollars (AUD)</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Stale after</dt><dd className="text-slate-900">7 days without activity</dd></div>
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Shortcuts</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/pipelines/new" className="btn-secondary">New pipeline</Link>
          <Link href="/templates" className="btn-secondary">Email templates</Link>
          {can(profile, "forms.manage") && <Link href="/forms" className="btn-secondary">Lead forms</Link>}
          <Link href="/contacts/import" className="btn-secondary">Import contacts</Link>
          <a href="/export/contacts" className="btn-secondary" download>Export all contacts</a>
        </div>
      </section>
    </div>
  );
}
