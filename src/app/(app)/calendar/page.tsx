import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { dateInput, dateInputFrom, fromZoned, timeInput } from "@/lib/dates";

type TaskRow = { id: string; title: string; due_at: string; done: boolean; contacts: { id: string; first_name: string; last_name: string } | null };
type MeetingRow = { id: string; created_at: string; contacts: { id: string; first_name: string; last_name: string } | null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;

// Calendar maths on plain "YYYY-MM-DD" strings, so the time zone never shifts a day.
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => ymd(new Date(Date.parse(s + "T00:00:00Z") + n * 86_400_000));

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const today = dateInput(0);
  const month = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const first = `${month}-01`;
  const next = ymd(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1))); // first day of next month
  const prev = ymd(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 2, 1)));

  // grid: Monday before the 1st through the Sunday after the last day
  const lead = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -lead);
  const lastDay = addDays(next, -1);
  const tail = 6 - ((new Date(lastDay + "T00:00:00Z").getUTCDay() + 6) % 7);
  const gridEnd = addDays(lastDay, tail);
  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const { supabase, profile } = await requireProfile();
  const from = fromZoned(gridStart, "00:00")!.toISOString();
  const to = fromZoned(addDays(gridEnd, 1), "00:00")!.toISOString();

  const [{ data: tasks }, { data: meetings }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_at, done, contacts(id, first_name, last_name)").gte("due_at", from).lt("due_at", to).order("due_at")
      .overrideTypes<TaskRow[], { merge: false }>(),
    supabase.from("activities").select("id, created_at, contacts(id, first_name, last_name)").eq("type", "meeting").gte("created_at", from).lt("created_at", to).order("created_at")
      .overrideTypes<MeetingRow[], { merge: false }>(),
  ]);

  type Item = { key: string; time: string; label: string; href: string; kind: "task" | "done" | "overdue" | "meeting" };
  const byDay = new Map<string, Item[]>();
  const push = (day: string, it: Item) => byDay.set(day, [...(byDay.get(day) ?? []), it]);
  for (const t of tasks ?? []) {
    const day = dateInputFrom(t.due_at);
    const kind = t.done ? "done" : day < today ? "overdue" : "task";
    push(day, { key: "t" + t.id, time: timeInput(t.due_at), label: t.title, href: t.contacts ? `/contacts/${t.contacts.id}` : `/tasks/${t.id}`, kind });
  }
  for (const m of meetings ?? []) {
    const who = m.contacts ? `${m.contacts.first_name} ${m.contacts.last_name}`.trim() : "Meeting";
    push(dateInputFrom(m.created_at), { key: "m" + m.id, time: timeInput(m.created_at), label: `Meeting: ${who}`, href: m.contacts ? `/contacts/${m.contacts.id}` : "/contacts", kind: "meeting" });
  }
  for (const list of byDay.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const style = {
    task: "bg-teal-50 text-teal-800 hover:bg-teal-100",
    overdue: "bg-red-50 text-red-700 hover:bg-red-100",
    done: "bg-slate-100 text-slate-400 line-through hover:bg-slate-200",
    meeting: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  };
  const title = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(first + "T00:00:00Z"));
  const nav = "btn-secondary";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
          <p className="mt-0.5 text-sm text-slate-500">{profile.scope === "all" ? "Everyone's follow-ups and meetings" : "Your follow-ups and meetings"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?m=${prev.slice(0, 7)}`} className={nav} aria-label="Previous month">‹</Link>
          <span className="w-36 text-center text-sm font-semibold text-slate-900">{title}</span>
          <Link href={`/calendar?m=${next.slice(0, 7)}`} className={nav} aria-label="Next month">›</Link>
          <Link href="/calendar" className={nav}>Today</Link>
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-500" />Task</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Overdue</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />Meeting</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />Done</span>
      </div>

      <div className="card mt-3 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((w) => <div key={w} className="px-3 py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            const inMonth = d.startsWith(month);
            return (
              <div key={d} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${inMonth ? "bg-white" : "bg-slate-50/60"}`}>
                <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${d === today ? "bg-accent font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-400"}`}>
                  {+d.slice(8)}
                </span>
                <div className="mt-1 space-y-1">
                  {items.slice(0, MAX_PER_DAY).map((it) => (
                    <Link key={it.key} href={it.href} title={`${it.time} · ${it.label}`} className={`block truncate rounded px-1.5 py-0.5 text-xs ${style[it.kind]}`}>
                      <span className="opacity-70">{it.time}</span> {it.label}
                    </Link>
                  ))}
                  {items.length > MAX_PER_DAY && <p className="px-1 text-xs text-slate-400">+{items.length - MAX_PER_DAY} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
