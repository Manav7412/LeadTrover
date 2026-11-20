import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { SharingForm } from "@/components/SettingsForms";
import { can } from "@/lib/permissions";
import { addSharingRule, deleteSharingRule } from "../actions";

type Rule = { id: string; access: "view" | "edit"; from_user: string; to_user: string };

export default async function SharingPage() {
  const { supabase, profile } = await requireProfile();
  const [{ data: members }, { data: rules, error }, { data: roles }, { data: people }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("sharing_rules").select("id, access, from_user, to_user").order("created_at").overrideTypes<Rule[], { merge: false }>(),
    supabase.from("roles").select("id, name, data_scope").order("created_at"),
    supabase.from("profiles").select("role_id"),
  ]);
  if (error) {
    return <div className="card p-8 text-sm text-slate-600">Sharing rules aren&apos;t set up yet. Run <code>supabase/permissions.sql</code> in Supabase first.</div>;
  }
  const name = (id: string) => (members ?? []).find((m) => m.id === id)?.full_name ?? "Someone";
  const admin = can(profile, "roles.manage");
  const mine = (rules ?? []).filter((r) => r.to_user === profile.id);

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Who sees what</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">
          Each person&apos;s <b>role</b> decides the starting point: some roles see everyone&apos;s records, others only their own. Sharing rules (below) open up more.
        </p>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {(roles ?? []).map((r) => {
            const n = (people ?? []).filter((p) => p.role_id === r.id).length;
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span><b className="text-slate-900">{r.name}</b> <span className="text-slate-400">· {n} {n === 1 ? "person" : "people"}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.data_scope === "all" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                  {r.data_scope === "all" ? "Sees everyone's records" : "Sees only own records"}
                </span>
              </li>
            );
          })}
        </ul>
        {admin && <p className="mt-3 text-xs text-slate-500">To change this, open <Link href="/settings/roles" className="font-medium text-accent hover:underline">Roles &amp; permissions</Link>.</p>}
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Sharing rules</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">
          {admin
            ? "Let one person see (or edit) another person's contacts, deals and tasks, without changing anyone's role."
            : "Let a teammate see (or edit) your contacts, deals and tasks. You can only share your own records."}
        </p>

        {(rules ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No sharing rules yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {(rules ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-slate-700">
                  <b className="text-slate-900">{name(r.to_user)}</b> can {r.access === "edit" ? "view and edit" : "view"} the records of <b className="text-slate-900">{name(r.from_user)}</b>
                </span>
                {(admin || r.from_user === profile.id) && (
                  <form action={deleteSharingRule.bind(null, r.id)}><button className="text-xs text-slate-400 hover:text-red-600">Remove</button></form>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-sm font-medium text-slate-900">Add a sharing rule</h3>
          <SharingForm action={addSharingRule} members={members ?? []} meId={profile.id} canPickFrom={admin} />
        </div>
      </section>

      {mine.length > 0 && (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Shared with you</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {mine.map((r) => <li key={r.id}>{name(r.from_user)} ({r.access === "edit" ? "view and edit" : "view only"})</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
