import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { BarList, Card, ColumnChart, DataTable, StatTile, type BarDatum, type ColumnDatum } from "@/components/charts";
import { dateInput, dateInputFrom, dayLabel, startOfToday } from "@/lib/dates";
import { formatMoney } from "@/lib/deals";
import { DENIED, can } from "@/lib/permissions";

const RANGES = [7, 14, 30] as const;
const money = (n: number) => formatMoney(n);
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.range) ?? 30;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "dashboard.view")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const isOwner = profile.scope === "all";

  const startMs = startOfToday().getTime() - (days - 1) * 86_400_000;
  const startISO = new Date(startMs).toISOString();

  const { data: pipelines } = await supabase.from("pipelines").select("id, name").order("position");
  const pipeline = (pipelines ?? []).find((p) => p.id === sp.p) ?? (pipelines ?? [])[0];

  const [contactsQ, activitiesQ, closedQ, stagesQ, dealsQ, teamQ] = await Promise.all([
    supabase.from("contacts").select("source, owner_id").gte("created_at", startISO),
    supabase.from("activities").select("type, outcome, created_at, user_id").gte("created_at", startISO),
    supabase.from("deals").select("status, value, owner_id").in("status", ["won", "lost"]).gte("closed_at", startISO),
    supabase.from("stages").select("id, name").eq("pipeline_id", pipeline?.id ?? "").order("position"),
    supabase.from("deals").select("value, stage_id, status").eq("pipeline_id", pipeline?.id ?? ""),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const contacts = contactsQ.data ?? [];
  const activities = activitiesQ.data ?? [];
  const closed = closedQ.data ?? [];
  const stages = stagesQ.data ?? [];
  const pDeals = dealsQ.data ?? [];

  // ---- headline numbers
  const calls = activities.filter((a) => a.type === "call");
  const booked = activities.filter((a) => a.outcome === "Booked meeting");
  const held = activities.filter((a) => a.type === "meeting");
  const won = closed.filter((d) => d.status === "won");
  const winRate = closed.length ? Math.round((won.length / closed.length) * 100) : null;
  const openValue = pDeals.filter((d) => d.status === "open").reduce((s, d) => s + Number(d.value), 0);

  // ---- calls per day
  const callsByDay = new Map<string, number>();
  for (const c of calls) callsByDay.set(dateInputFrom(c.created_at), (callsByDay.get(dateInputFrom(c.created_at)) ?? 0) + 1);
  const dayList = Array.from({ length: days }, (_, i) => dateInput(-(days - 1 - i)));
  const callData: ColumnDatum[] = dayList.map((d) => {
    const n = callsByDay.get(d) ?? 0;
    return { label: dayLabel(d).replace(/^\w+ /, ""), value: n, tip: `${dayLabel(d)}: ${plural(n, "call")}` };
  });

  // ---- leads by source (ranked, biggest first)
  const bySource = new Map<string, number>();
  for (const c of contacts) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  const sourceData: BarDatum[] = [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
    label, value, display: String(value), tip: `${label}: ${plural(value, "new lead")}`,
  }));

  // ---- pipeline value by stage (in the board's order)
  const stageData: BarDatum[] = stages.map((s) => {
    const ds = pDeals.filter((d) => d.stage_id === s.id);
    const value = ds.reduce((sum, d) => sum + Number(d.value), 0);
    return { label: s.name, value, display: money(value), tip: `${s.name}: ${money(value)} across ${plural(ds.length, "deal")}` };
  });

  // ---- results by rep (a Rep only ever sees their own row)
  const team = (teamQ.data ?? []).filter((m) => isOwner || m.id === profile.id);
  const repRows = team.map((m) => {
    const wonByRep = won.filter((d) => d.owner_id === m.id);
    const closedByRep = closed.filter((d) => d.owner_id === m.id);
    return {
      name: m.full_name,
      leads: contacts.filter((c) => c.owner_id === m.id).length,
      calls: calls.filter((a) => a.user_id === m.id).length,
      booked: booked.filter((a) => a.user_id === m.id).length,
      wonCount: wonByRep.length,
      wonValue: wonByRep.reduce((s, d) => s + Number(d.value), 0),
      rate: closedByRep.length ? `${Math.round((wonByRep.length / closedByRep.length) * 100)}%` : "—",
    };
  });

  const href = (o: { range?: number; p?: string }) => `/dashboard?range=${o.range ?? days}${(o.p ?? pipeline?.id) ? `&p=${o.p ?? pipeline?.id}` : ""}`;
  const periodLabel = `Last ${days} days`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">{isOwner ? "Whole team" : "Your numbers"} · {periodLabel}</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {RANGES.map((r) => (
            <Link key={r} href={href({ range: r })} className={`rounded-md px-3 py-1.5 text-sm font-medium ${r === days ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="New leads" value={String(contacts.length)} sub={periodLabel} />
        <StatTile label="Calls made" value={String(calls.length)} sub={calls.length ? `${(calls.length / days).toFixed(1)} per day` : periodLabel} />
        <StatTile label="Meetings booked" value={String(booked.length)} sub={`${plural(held.length, "meeting")} held`} />
        <StatTile label="Win rate" value={winRate === null ? "—" : `${winRate}%`} sub={closed.length ? `${won.length} won of ${plural(closed.length, "closed deal")}` : "No deals closed in this period"} />
        <StatTile label={`Open value: ${pipeline?.name ?? "pipeline"}`} value={money(openValue)} sub={`${plural(pDeals.filter((d) => d.status === "open").length, "open deal")}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Calls per day" subtitle={`${calls.length} calls in the ${periodLabel.toLowerCase()}`}>
            <ColumnChart data={callData} unit="Calls" />
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card title="Leads by source" subtitle={`New contacts, ${periodLabel.toLowerCase()}`}>
            <BarList data={sourceData} unit="Leads" empty="No new leads in this period." />
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card
            title="Pipeline value by stage"
            subtitle="Total deal value in each stage right now"
            action={
              <div className="flex flex-wrap justify-end gap-1">
                {(pipelines ?? []).map((p) => (
                  <Link key={p.id} href={href({ p: p.id })} className={`rounded-md px-2 py-1 text-xs font-medium ${p.id === pipeline?.id ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-50"}`}>
                    {p.name}
                  </Link>
                ))}
              </div>
            }
          >
            <BarList data={stageData} unit="Value" empty="No deals in this pipeline yet." />
          </Card>
        </div>
        <div className="lg:col-span-3">
          <Card title="Results by rep" subtitle={isOwner ? `${periodLabel}. Wins use the date a deal was closed.` : "You only see your own results."}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Rep</th>
                    <th className="px-3 py-2 text-right font-medium">New leads</th>
                    <th className="px-3 py-2 text-right font-medium">Calls</th>
                    <th className="px-3 py-2 text-right font-medium">Meetings booked</th>
                    <th className="px-3 py-2 text-right font-medium">Deals won</th>
                    <th className="px-3 py-2 text-right font-medium">Won value</th>
                    <th className="py-2 pl-3 text-right font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums text-slate-700">
                  {repRows.map((r) => (
                    <tr key={r.name}>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{r.name.slice(0, 2).toUpperCase()}</span>
                          {r.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">{r.leads}</td>
                      <td className="px-3 py-3 text-right">{r.calls}</td>
                      <td className="px-3 py-3 text-right">{r.booked}</td>
                      <td className="px-3 py-3 text-right">{r.wonCount}</td>
                      <td className="px-3 py-3 text-right">{money(r.wonValue)}</td>
                      <td className="py-3 pl-3 text-right">{r.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {repRows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No team members found.</p>}
            <DataTable
              columns={["Rep", "Leads", "Calls", "Booked", "Won", "Won value", "Win rate"]}
              rows={repRows.map((r) => [r.name, r.leads, r.calls, r.booked, r.wonCount, money(r.wonValue), r.rate])}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
