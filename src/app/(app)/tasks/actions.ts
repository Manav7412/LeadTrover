"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { fromZoned } from "@/lib/dates";
import type { FormState } from "@/lib/contacts";
import { DENIED, can } from "@/lib/permissions";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

async function readTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const title = clean(formData.get("title"));
  if (!title) return { error: "Give the task a title." } as const;
  const due = fromZoned(String(formData.get("due_date") ?? ""), String(formData.get("due_time") || "09:00"));
  if (!due) return { error: "Choose a due date." } as const;
  const assigned_to = profile.scope === "all" ? clean(formData.get("assigned_to")) ?? profile.id : profile.id;
  return { supabase, profile, values: { title, due_at: due.toISOString(), contact_id: clean(formData.get("contact_id")), assigned_to } } as const;
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await readTask(formData);
  if ("error" in t) return { error: t.error };
  if (!can(t.profile, "tasks.manage")) return { error: DENIED };
  const { error } = await t.supabase.from("tasks").insert(t.values);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTask(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await readTask(formData);
  if ("error" in t) return { error: t.error };
  if (!can(t.profile, "tasks.manage")) return { error: DENIED };
  const changes: Record<string, unknown> = { title: t.values.title, due_at: t.values.due_at, contact_id: t.values.contact_id };
  if (t.profile.scope === "all") changes.assigned_to = t.values.assigned_to;
  const { error } = await t.supabase.from("tasks").update(changes).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function toggleTask(id: string, done: boolean) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "tasks.manage")) return;
  await supabase.from("tasks").update({ done }).eq("id", id);
  revalidatePath("/tasks");
  revalidatePath("/welcome");
}

export async function deleteTask(id: string) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "tasks.manage")) return;
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
}
