import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import TaskForm from "@/components/TaskForm";
import { dateInput } from "@/lib/dates";
import { createTask } from "../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "tasks.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const [{ data: contacts }, { data: team }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <div>
      <Link href="/tasks" className="text-sm text-slate-500 hover:text-slate-800">← Tasks</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Add task</h1>
      <TaskForm
        action={createTask}
        contacts={(contacts ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }))}
        team={team ?? []}
        isOwner={profile.scope === "all"}
        currentUserId={profile.id}
        defaults={{ due_date: dateInput(1), due_time: "09:00", contact_id: typeof sp.contact === "string" ? sp.contact : null }}
        submitLabel="Add task"
      />
    </div>
  );
}
