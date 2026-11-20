"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/activities";
import { recordActivity } from "@/lib/log-activity";
import { DENIED, can } from "@/lib/permissions";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export async function logActivity(contactId: string, formData: FormData): Promise<{ error?: string; taskDue?: string }> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "activities.log")) return { error: DENIED };
  const type = String(formData.get("type"));
  if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) return { error: "Choose what kind of activity this is." };

  const outcome = clean(formData.get("outcome"));
  const notes = clean(formData.get("notes"));
  const nextStep = clean(formData.get("next_step"));
  if (!outcome && !notes && !nextStep) return { error: "Add an outcome, some notes or a next step." };

  return recordActivity({
    supabase, userId: profile.id, contactId, type: type as ActivityType, outcome, notes, nextStep,
    dealId: clean(formData.get("deal_id")), followUpDate: clean(formData.get("follow_up_date")),
  });
}

export async function deleteActivity(activityId: string, contactId: string) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "activities.log")) return;
  await supabase.from("activities").delete().eq("id", activityId);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}
