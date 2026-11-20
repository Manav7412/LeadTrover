import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { todaysPick } from "@/lib/sales-content";
import { dateInput, dateInputFrom, dayLabel, formatDue, fromZoned, startOfToday } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/deals";
import AskBar from "@/components/AskBar";

type ActRow = { id: string; type: string; outcome: string | null; created_at: string; contacts: { id: string; first_name: string; last_name: string } | null; profiles: { full_name: string } | null };
type TaskRow = { id: string; title: string; due_at: string; contacts: { id: string; first_name: string; last_name: string } | null };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => ymd(new Date(Date.parse(s + "T00:00:00Z") + n * 86_400_000));
const ACTION_LABEL: Record<string, string> = { call: "Call", email: "Email", note: "Note", meeting: "Meeting" };

function Widget({ title, href, linkLabel = "View all", children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
        {href && <Link href={href} className="text-xs font-medium text-accent hover:underline">{linkLabel}</Link>}
      </div>
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-6 text-center text-sm text-slate-400">{children}</p>;

export default async function WelcomePage() {
  const { supabase, profile } = await requireProfile();
  await supabase.rpc("refresh_stale_leads");
  const { count: staleCount } = await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("is_stale", true);
  const dayStart = startOfToday().getTime();
  const { data: open } = await supabase.from("tasks").select("due_at").eq("done", false);
  const dueToday = (open ?? []).filter((t) => { const d = new Date(t.due_at).getTime(); return d >= dayStart && d < dayStart + 86_400_000; }).length;
  const overdue = (open ?? []).filter((t) => new Date(t.due_at).getTime() < dayStart).length;
  const nowDate = new Date();
  const todayStr = dateInput(0);
  const month = todayStr.slice(0, 7);
  const first = `${month}-01`;
  const nextMonth = ymd(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)));
  const [{ data: acts }, { data: staleList }, { data: dueTasks }, { data: pipelines }, { data: monthTasks }] = await Promise.all([
    supabase.from("activities").select("id, type, outcome, created_at, contacts(id, first_name, last_name), profiles:user_id(full_name)").order("created_at", { ascending: false }).limit(5)
      .overrideTypes<ActRow[], { merge: false }>(),
    supabase.from("contacts").select("id, first_name, last_name, last_activity_at").eq("is_stale", true).order("last_activity_at", { ascending: true, nullsFirst: true }).limit(5),
    supabase.from("tasks").select("id, title, due_at, contacts(id, first_name, last_name)").eq("done", false).lt("due_at", new Date(dayStart + 86_400_000).toISOString()).order("due_at").limit(6)
      .overrideTypes<TaskRow[], { merge: false }>(),
    supabase.from("pipelines").select("id, name").order("position"),
    supabase.from("tasks").select("due_at").eq("done", false).gte("due_at", fromZoned(first, "00:00")!.toISOString()).lt("due_at", fromZoned(nextMonth, "00:00")!.toISOString()),
  ]);
  const pipeline = (pipelines ?? []).find((p) => p.name === "Sales") ?? (pipelines ?? [])[0];
  const [{ data: stages }, { data: deals }] = await Promise.all([
    supabase.from("stages").select("id, name, outcome").eq("pipeline_id", pipeline?.id ?? "").order("position"),
    supabase.from("deals").select("value, stage_id, status, closed_at").eq("pipeline_id", pipeline?.id ?? ""),
  ]);
  const openStages = (stages ?? []).filter((st) => st.outcome === "open").map((st) => {
    const ds = (deals ?? []).filter((d) => d.stage_id === st.id && d.status === "open");
    return { id: st.id, name: st.name, count: ds.length, value: ds.reduce((sum, d) => sum + Number(d.value), 0) };
  });
  const maxValue = Math.max(1, ...openStages.map((x) => x.value));
  const monthAgo = nowDate.getTime() - 30 * 86_400_000;
  const wonValue = (deals ?? []).filter((d) => d.status === "won" && d.closed_at && new Date(d.closed_at).getTime() >= monthAgo).reduce((sum, d) => sum + Number(d.value), 0);

  // mini calendar
  const taskDays = new Set((monthTasks ?? []).map((t) => dateInputFrom(t.due_at)));
  const lead = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const lastDay = addDays(nextMonth, -1);
  const tail = 6 - ((new Date(lastDay + "T00:00:00Z").getUTCDay() + 6) % 7);
  const cells: string[] = [];
  for (let d = addDays(first, -lead); d <= addDays(lastDay, tail); d = addDays(d, 1)) cells.push(d);
  const monthTitle = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(first + "T00:00:00Z"));
  const { quote, fact } = todaysPick();
  const firstName = profile.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-[1400px] pt-2">
      <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
        <div className="space-y-5">
          <Widget title="Quick actions">
            <div className="space-y-2.5">
              {[
                { label: "Quick lead", hint: "Add a contact", href: "/contacts/new", ok: can(profile, "contacts.create"), d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" },
                { label: "Add task", hint: "Set a follow-up", href: "/tasks/new", ok: can(profile, "tasks.manage"), d: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" },
                { label: "Log call", hint: "Pick a contact", href: "/contacts", ok: can(profile, "activities.log"), d: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" },
                { label: "Meeting invite", hint: "Pick a contact", href: "/contacts", ok: can(profile, "activities.log"), d: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
              ].map((a) => (
                a.ok ? (
                  <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-accent hover:bg-accent-soft/50">
                    <span className="text-slate-700">
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={a.d} /></svg>
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-900">{a.label}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </Link>
                ) : null
              ))}
            </div>
          </Widget>

          <Widget title="Last actions" href="/contacts" linkLabel="Contacts">
            {(acts ?? []).length === 0 ? <Empty>Nothing logged yet. Log a call to get started.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {(acts ?? []).map((a) => (
                  <li key={a.id} className="py-2.5 text-sm">
                    <span className="block min-w-0">
                      <span className="mr-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{ACTION_LABEL[a.type] ?? a.type}</span>
                      {a.contacts ? <Link href={`/contacts/${a.contacts.id}`} className="font-medium text-slate-800 hover:text-accent">{a.contacts.first_name} {a.contacts.last_name}</Link> : "—"}
                      {a.outcome && <span className="text-slate-500"> · {a.outcome}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">{a.profiles?.full_name.split(" ")[0] ?? ""} · {dateInputFrom(a.created_at) === todayStr ? "Today" : dayLabel(dateInputFrom(a.created_at))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <Widget title={`Pipeline snapshot${pipeline ? ` · ${pipeline.name}` : ""}`} href="/pipelines" linkLabel="Open board">
            {openStages.length === 0 ? <Empty>No pipeline yet.</Empty> : (
              <>
                <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
                  <div><p className="text-2xl font-bold tracking-tight text-slate-900">{formatMoney(openStages.reduce((sum, x) => sum + x.value, 0))}</p><p className="text-xs text-slate-500">Open value</p></div>
                  <div><p className="text-2xl font-bold tracking-tight text-accent">{formatMoney(wonValue)}</p><p className="text-xs text-slate-500">Won (30 days)</p></div>
                </div>
                <ul className="space-y-2.5">
                  {openStages.map((x) => (
                    <li key={x.id}>
                      <div className="flex justify-between text-xs"><span className="text-slate-700">{x.name} <span className="text-slate-400">· {x.count}</span></span><span className="text-slate-500">{formatMoney(x.value)}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(x.value ? 4 : 0, (x.value / maxValue) * 100)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Widget>
        </div>

        <div className="order-first min-w-0 xl:order-none">
      <section className="relative overflow-hidden rounded-2xl bg-sidebar px-8 py-9 lg:px-10 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl" aria-hidden />
        <p className="relative text-sm font-medium text-teal-300">{today}</p>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">Welcome back, {firstName}</h1>
        <p className="relative mt-3 max-w-xl text-slate-300">
          Every lead has an owner and a next step. Let&apos;s make sure nothing slips today.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2 text-sm">
          <Link href="/tasks?tab=today" className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
            <b>{dueToday}</b> {dueToday === 1 ? "task" : "tasks"} due today
          </Link>
          <Link href="/tasks?tab=overdue" className={`rounded-full px-3 py-1 ${overdue ? "bg-red-500/30 hover:bg-red-500/40" : "bg-white/10 hover:bg-white/20"}`}>
            <b>{overdue}</b> overdue
          </Link>
          <Link href="/contacts?stale=1" className={`rounded-full px-3 py-1 ${staleCount ? "bg-amber-400/25 hover:bg-amber-400/35" : "bg-white/10 hover:bg-white/20"}`}>
            <b>{staleCount ?? 0}</b> stale {staleCount === 1 ? "lead" : "leads"}
          </Link>
        </div>
        <div className="relative mt-7 flex flex-wrap gap-3">
          <Link href="/contacts" className="btn-primary">Go to contacts</Link>
          <Link href="/pipelines" className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Open pipelines
          </Link>
        </div>
      </section>
      <div className="mt-6 grid gap-5 md:grid-cols-5">
        <figure className="card p-7 md:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Quote of the day</p>
          <blockquote className="mt-3 text-xl font-medium leading-snug text-slate-900">&ldquo;{quote.text}&rdquo;</blockquote>
          <figcaption className="mt-4 text-sm text-slate-500">{quote.author}</figcaption>
        </figure>
        <div className="card bg-accent-soft/60 p-7 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Did you know?</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{fact}</p>
        </div>
      </div>
      <AskBar firstName={firstName} />
        </div>
        <div className="space-y-5">
          <Widget title="Today's tasks" href="/tasks" linkLabel="All tasks">
            {(dueTasks ?? []).length === 0 ? <Empty>Nothing due today. Nice work!</Empty> : (
              <ul className="divide-y divide-slate-100">
                {(dueTasks ?? []).map((t) => {
                  const late = new Date(t.due_at).getTime() < dayStart;
                  return (
                    <li key={t.id} className="flex items-start gap-2.5 py-2.5 text-sm">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">{t.title}</span>
                        {t.contacts && <Link href={`/contacts/${t.contacts.id}`} className="text-xs text-slate-500 hover:text-accent">{t.contacts.first_name} {t.contacts.last_name}</Link>}
                      </span>
                      <span className={`ml-auto shrink-0 text-xs ${late ? "font-medium text-red-600" : "text-slate-500"}`}>{late ? "Overdue" : formatDue(t.due_at, nowDate).replace(/^Today /, "")}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>

          <Widget title={`Stale leads (${staleCount ?? 0})`} href="/contacts?stale=1">
            {(staleList ?? []).length === 0 ? <Empty>No stale leads. Every lead is moving.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {(staleList ?? []).map((c) => {
                  const days = c.last_activity_at ? Math.floor((nowDate.getTime() - new Date(c.last_activity_at).getTime()) / 86_400_000) : null;
                  return (
                    <li key={c.id} className="flex items-center gap-2.5 py-2.5 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600" aria-hidden>!</span>
                      <Link href={`/contacts/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-accent">{c.first_name} {c.last_name}</Link>
                      <span className="shrink-0 text-xs text-slate-500">{days === null ? "never" : `${days}d`}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>

          <Widget title={`Calendar · ${monthTitle}`} href="/calendar" linkLabel="Open calendar">
            <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
              {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <span key={i} className="pb-1 font-medium text-slate-400">{w}</span>)}
              {cells.map((d) => {
                const inMonth = d.startsWith(month);
                return (
                  <span key={d} className="flex flex-col items-center py-0.5">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${d === todayStr ? "bg-accent font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{+d.slice(8)}</span>
                    <span className={`mt-0.5 h-1 w-1 rounded-full ${taskDays.has(d) && inMonth ? "bg-accent" : "bg-transparent"}`} />
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">A dot means a task is due that day.</p>
          </Widget>
        </div>
      </div>
    </div>
  );
}
