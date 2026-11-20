import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import DeleteContactButton from "@/components/DeleteContactButton";
import ActivityForm from "@/components/ActivityForm";
import ActivityTimeline, { type TimelineItem } from "@/components/ActivityTimeline";
import { formatMoney } from "@/lib/deals";
import { dateInput } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { STATUS_STYLES, timeAgo } from "@/lib/contacts";
import { getCustomFields } from "@/lib/custom-fields";
import { showValue } from "@/lib/objects";
import { deleteContact } from "../actions";

export default async function ContactPage({ params, searchParams }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const { data: c } = await supabase
    .from("contacts")
    .select("*, companies(name, website, industry), profiles:owner_id(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [{ data: acts }, { data: deals }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, type, outcome, notes, next_step, created_at, profiles:user_id(full_name), deals(title)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .overrideTypes<TimelineItem[], { merge: false }>(),
    supabase.from("deals").select("id, title, value, status, stages(name)").eq("contact_id", id)
      .overrideTypes<{ id: string; title: string; value: number; status: string; stages: { name: string } | null }[], { merge: false }>(),
  ]);
  const customFields = await getCustomFields(supabase, "contacts");
  const activities = acts ?? [];
  const nextStep = activities.find((a) => a.next_step)?.next_step ?? null;
  const closed = c.status === "customer" || c.status === "lost";

  const rows: [string, React.ReactNode][] = [
    ["Email", c.email ?? "—"],
    ["Phone", c.phone ?? "—"],
    ["Company", c.companies?.name ?? "—"],
    ["Industry", c.companies?.industry ?? "—"],
    ["Owner", c.profiles?.full_name ?? "Unassigned"],
    ["Source", c.source],
    ["Added", new Date(c.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })],
    ["Last activity", timeAgo(c.last_activity_at)],
    ...customFields.map((f): [string, React.ReactNode] => [f.label, showValue(f, (c.custom ?? {})[f.key])]),
  ];

  return (
    <div>
      <Link href="/contacts" className="text-sm text-slate-500 hover:text-slate-800">← Contacts</Link>
      <div className="mb-5 mt-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent">
            {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{c.first_name} {c.last_name}</h1>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>{c.status}</span>
              {c.is_stale && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Stale</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {can(profile, "activities.log") && <Link href={`/contacts/${id}/email`} className="btn-primary">Email</Link>}
          {can(profile, "contacts.edit") && <Link href={`/contacts/${id}/edit`} className="btn-secondary">Edit</Link>}
          {can(profile, "contacts.delete") && <DeleteContactButton action={deleteContact.bind(null, id)} />}
        </div>
      </div>

      {sp.auto && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <b>Auto-assigned:</b> LeadTrove gave this lead to {c.profiles?.full_name ?? "a team member"}, who had the fewest open leads.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Details</h2>
          <dl className="space-y-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-4">
            {c.tags.length === 0 && <span className="text-sm text-slate-400">No tags</span>}
            {c.tags.map((t: string) => <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t}</span>)}
          </div>
          {(deals ?? []).length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Deals</h3>
              <ul className="space-y-2 text-sm">
                {(deals ?? []).map((d) => (
                  <li key={d.id} className="flex justify-between gap-3">
                    <Link href={`/deals/${d.id}`} className="text-slate-800 hover:text-accent">{d.title}</Link>
                    <span className="shrink-0 text-slate-500">{d.stages?.name} · {formatMoney(Number(d.value))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-5 lg:col-span-2">
          {!closed && (
            <div className={`rounded-xl border px-5 py-3 text-sm ${nextStep ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
              {nextStep ? <><b>Next step:</b> {nextStep}</> : <><b>No next step set.</b> Log an activity below and say what happens next.</>}
            </div>
          )}
          {can(profile, "activities.log") && <ActivityForm contactId={id} defaultFollowUp={dateInput(1)} deals={(deals ?? []).map((d) => ({ id: d.id, title: d.title }))} />}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
            {can(profile, "contacts.export") && <a href={`/export/timeline?contact=${id}`} className="text-xs font-medium text-accent hover:underline" download>Export timeline CSV</a>}
          </div>
          <ActivityTimeline items={activities} contactId={id} canDelete={can(profile, "activities.log")} />
        </div>
      </div>
    </div>
  );
}
