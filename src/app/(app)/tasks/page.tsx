import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { formatDue, startOfToday } from "@/lib/dates";
import { bucketTasks } from "@/lib/tasks";
import { can } from "@/lib/permissions";
import { toggleTask, deleteTask } from "./actions";

type TaskRow = {
  id: string; title: string; due_at: string; done: boolean;
  contacts: { id: string; first_name: string; last_name: string } | null;
  profiles: { full_name: string } | null;
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "done", label: "Done" },
] as const;

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "today";
  const who = typeof sp.who === "string" ? sp.who : "";
  const { supabase, profile } = await requireProfile();

  let query = supabase
    .from("tasks")
    .select("id, title, due_at, done, contacts(id, first_name, last_name), profiles:assigned_to(full_name)")
    .order("due_at", { ascending: true });
  if (who && profile.scope === "all") query = query.eq("assigned_to", who);

  const [{ data }, { data: team }] = await Promise.all([
    query.overrideTypes<TaskRow[], { merge: false }>(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const all = data ?? [];

  const now = new Date();
  const dayStart = startOfToday(now).getTime();
  const groups = bucketTasks(all, dayStart);
  const due = (t: TaskRow) => new Date(t.due_at).getTime();
  const tasks = groups[tab];
  const empty = {
    today: "Nothing due today. Nice work!",
    overdue: "No overdue tasks. Every follow-up is on track.",
    upcoming: "No upcoming tasks.",
    done: "No completed tasks yet.",
  }[tab];

  const href = (t: string) => `/tasks?tab=${t}${who ? `&who=${who}` : ""}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">{profile.scope === "all" ? "Everyone's follow-ups" : "Your follow-ups"}</p>
        </div>
        <div className="flex gap-2">
          {can(profile, "contacts.export") && <a href={`/export/tasks?tab=${tab}${who ? `&who=${who}` : ""}`} className="btn-secondary" download>Export CSV</a>}
          {can(profile, "tasks.manage") && <Link href="/tasks/new" className="btn-primary">+ Add task</Link>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${
                tab === t.key ? "bg-white/25 text-white" : t.key === "overdue" && groups.overdue.length ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
              }`}>{groups[t.key].length}</span>
            </Link>
          ))}
        </div>
        {profile.scope === "all" && (
          <form className="ml-auto flex items-center gap-2">
            <input type="hidden" name="tab" value={tab} />
            <select name="who" defaultValue={who} className="input !w-44">
              <option value="">Everyone</option>
              {(team ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <button className="btn-secondary">Filter</button>
          </form>
        )}
      </div>

      <div className="card mt-4 overflow-hidden">
        {tasks.length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-500">{empty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3" />
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                {profile.scope === "all" && <th className="px-4 py-3 font-medium">Assigned to</th>}
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t) => {
                const late = !t.done && due(t) < dayStart;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <form action={toggleTask.bind(null, t.id, !t.done)}>
                        <button
                          disabled={!can(profile, "tasks.manage")}
                          aria-label={t.done ? "Mark as not done" : "Mark as done"}
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            t.done ? "border-accent bg-accent text-white" : "border-slate-300 hover:border-accent"
                          }`}
                        >
                          {t.done && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                        </button>
                      </form>
                    </td>
                    <td className={`px-4 py-3 font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</td>
                    <td className="px-4 py-3">
                      {t.contacts ? (
                        <Link href={`/contacts/${t.contacts.id}`} className="text-slate-700 hover:text-accent">
                          {t.contacts.first_name} {t.contacts.last_name}
                        </Link>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    {profile.scope === "all" && <td className="px-4 py-3 text-slate-600">{t.profiles?.full_name ?? "Unassigned"}</td>}
                    <td className={`whitespace-nowrap px-4 py-3 ${late ? "font-medium text-red-600" : "text-slate-600"}`}>{formatDue(t.due_at, now)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 text-xs">
                        {can(profile, "tasks.manage") && <Link href={`/tasks/${t.id}`} className="text-slate-400 hover:text-accent">Edit</Link>}
                        {can(profile, "tasks.manage") && <form action={deleteTask.bind(null, t.id)}><button className="text-slate-400 hover:text-red-600">Delete</button></form>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
