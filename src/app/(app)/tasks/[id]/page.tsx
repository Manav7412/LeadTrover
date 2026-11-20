import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import TaskForm from "@/components/TaskForm";
import { dateInputFrom, timeInput } from "@/lib/dates";
import { updateTask } from "../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function EditTaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "tasks.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) notFound();
  const [{ data: contacts }, { data: team }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <div>
      <Link href="/tasks" className="text-sm text-slate-500 hover:text-slate-800">← Tasks</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Edit task</h1>
      <TaskForm
        action={updateTask.bind(null, id)}
        contacts={(contacts ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }))}
        team={team ?? []}
        isOwner={profile.scope === "all"}
        currentUserId={profile.id}
        defaults={{ title: task.title, contact_id: task.contact_id, due_date: dateInputFrom(task.due_at), due_time: timeInput(task.due_at), assigned_to: task.assigned_to }}
        submitLabel="Save changes"
      />
    </div>
  );
}
