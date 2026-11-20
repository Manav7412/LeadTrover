import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { DENIED, can } from "@/lib/permissions";
import { startOfToday } from "@/lib/dates";

type Row = { id: string; first_name: string; last_name: string; owner_id: string | null; status: string; is_stale: boolean; last_activity_at: string | null };

const daysAgo = (iso: string | null, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null);

export default async function ReportsPage() {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "dashboard.view")) return <p className="text-sm text-slate-500">{DENIED}</p>;

  const [{ data: contacts }, { data: tasks }, { data: team }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name, owner_id, status, is_stale, last_activity_at").not("status", "in", "(customer,lost)"),
    supabase.from("tasks").select("contact_id, assigned_to, due_at, done").eq("done", false),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const leads = (contacts ?? []) as Row[];
  const open = tasks ?? [];
  const name = new Map((team ?? []).map((p) => [p.id, p.full_name]));
  const now = new Date().getTime();
  const dayStart = startOfToday().getTime();

  // The one idea of LeadTrove: every lead has an owner and a next step.
  const withTask = new Set(open.map((t) => t.contact_id).filter(Boolean));
  const noOwner = leads.filter((l) => !l.owner_id);
  const noNext = leads.filter((l) => !withTask.has(l.id));
  const stale = leads.filter((l) => l.is_stale).sort((a, b) => (a.last_activity_at ?? "").localeCompare(b.last_activity_at ?? ""));

  const reps = (team ?? []).map((p) => {
    const mine = leads.filter((l) => l.owner_id === p.id);
    const myTasks = open.filter((t) => t.assigned_to === p.id);
    return {
      id: p.id, name: p.full_name, leads: mine.length,
      stale: mine.filter((l) => l.is_stale).length,
      noNext: mine.filter((l) => !withTask.has(l.id)).length,
      overdue: myTasks.filter((t) => new Date(t.due_at).getTime() < dayStart).length,
    };
  }).filter((r) => r.leads || r.overdue);

  const link = (l: Row) => <Link href={`/contacts/${l.id}`} className="font-medium text-slate-800 hover:text-accent">{l.first_name} {l.last_name}</Link>;
  const tile = (label: string, n: number, hint: string) => (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${n ? "text-slate-900" : "text-teal-600"}`}>{n}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
  const th = "px-4 py-3 font-medium";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-0.5 text-sm text-slate-500">Is every open lead covered? An owner and a next step on each one means no follow-up is missed.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile("Open leads", leads.length, "Not yet customers or lost")}
        {tile("No owner", noOwner.length, "Nobody is responsible")}
        {tile("No next step", noNext.length, "No open task on the lead")}
        {tile("Stale", stale.length, "No activity for 7+ days")}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 text-base font-semibold text-slate-900">Stale leads</h2>
          <p className="px-4 pb-3 text-xs text-slate-500">Longest quiet first. Log a call or note to bring one back.</p>
          {stale.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No stale leads. Nice work!</p> : (
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className={th}>Lead</th><th className={th}>Owner</th><th className={th}>Quiet for</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {stale.slice(0, 10).map((l) => {
                  const d = daysAgo(l.last_activity_at, now);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">{link(l)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{l.owner_id ? name.get(l.owner_id) ?? "—" : "Unassigned"}</td>
                      <td className="px-4 py-2.5 text-red-600">{d === null ? "Never contacted" : `${d} days`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 text-base font-semibold text-slate-900">Leads with no next step</h2>
          <p className="px-4 pb-3 text-xs text-slate-500">These could slip through. Add a task or log an activity with a next step.</p>
          {noNext.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Every open lead has a next step.</p> : (
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className={th}>Lead</th><th className={th}>Owner</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {noNext.slice(0, 10).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">{link(l)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.owner_id ? name.get(l.owner_id) ?? "—" : "Unassigned"}</td>
                    <td className="px-4 py-2.5 capitalize text-slate-600">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {profile.scope === "all" && (
        <section className="card mt-6 overflow-hidden">
          <h2 className="px-4 pt-4 text-base font-semibold text-slate-900">Workload by person</h2>
          <p className="px-4 pb-3 text-xs text-slate-500">Who is carrying what, and where follow-ups are slipping.</p>
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className={th}>Person</th><th className={th}>Open leads</th><th className={th}>No next step</th><th className={th}>Stale</th><th className={th}>Overdue tasks</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reps.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.leads}</td>
                  <td className={`px-4 py-2.5 ${r.noNext ? "text-amber-600" : "text-slate-600"}`}>{r.noNext}</td>
                  <td className={`px-4 py-2.5 ${r.stale ? "text-red-600" : "text-slate-600"}`}>{r.stale}</td>
                  <td className={`px-4 py-2.5 ${r.overdue ? "text-red-600" : "text-slate-600"}`}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
