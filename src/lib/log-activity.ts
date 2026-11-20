import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateInput, formatDue, fromZoned } from "@/lib/dates";

type Input = {
  supabase: SupabaseClient;
  userId: string;
  contactId: string;
  type: "call" | "email" | "meeting" | "note";
  outcome: string | null;
  notes: string | null;
  nextStep: string | null;
  dealId?: string | null;
  followUpDate?: string | null; // "2026-11-21"; defaults to tomorrow
};

// Saves an activity on a contact's timeline. If it has a next step, also creates the follow-up task
// (assigned to the contact's owner) and marks the contact as recently worked (clears "stale").
export async function recordActivity(i: Input): Promise<{ error?: string; taskDue?: string }> {
  const { error } = await i.supabase.from("activities").insert({
    contact_id: i.contactId, deal_id: i.dealId ?? null, user_id: i.userId,
    type: i.type, outcome: i.outcome, notes: i.notes, next_step: i.nextStep,
  });
  if (error) return { error: error.message };

  let taskDue: string | undefined;
  if (i.nextStep) {
    const { data: contact } = await i.supabase.from("contacts").select("owner_id").eq("id", i.contactId).maybeSingle();
    const due = fromZoned(i.followUpDate || dateInput(1), "09:00") ?? fromZoned(dateInput(1), "09:00")!;
    const { error: taskError } = await i.supabase.from("tasks").insert({
      title: i.nextStep, contact_id: i.contactId, deal_id: i.dealId ?? null,
      assigned_to: contact?.owner_id ?? i.userId, due_at: due.toISOString(),
    });
    if (taskError) return { error: `Activity saved, but the follow-up task failed: ${taskError.message}` };
    taskDue = formatDue(due.toISOString());
    revalidatePath("/tasks");
  }

  const touched = await i.supabase.rpc("touch_contact", { cid: i.contactId });
  if (touched.error) await i.supabase.from("contacts").update({ last_activity_at: new Date().toISOString(), is_stale: false }).eq("id", i.contactId);
  revalidatePath(`/contacts/${i.contactId}`);
  revalidatePath("/contacts");
  return { taskDue };
}
