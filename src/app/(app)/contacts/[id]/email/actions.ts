"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { mergeValuesFor, renderTemplate } from "@/lib/merge";
import { recordActivity } from "@/lib/log-activity";
import type { FormState } from "@/lib/contacts";
import { DENIED, can } from "@/lib/permissions";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

type ContactRow = {
  first_name: string; last_name: string; email: string | null; phone: string | null;
  companies: { name: string } | null; profiles: { full_name: string } | null;
};

// "Sends" an email: for now it is only logged on the contact's timeline (real sending comes later).
export async function logEmail(contactId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "activities.log")) return { error: DENIED };
  const subjectRaw = clean(formData.get("subject"));
  const bodyRaw = String(formData.get("body") ?? "").trim();
  if (!subjectRaw) return { error: "Add a subject line." };
  if (!bodyRaw) return { error: "Write the email body." };

  const { data } = await supabase
    .from("contacts")
    .select("first_name, last_name, email, phone, companies(name), profiles:owner_id(full_name)")
    .eq("id", contactId)
    .maybeSingle()
    .overrideTypes<ContactRow, { merge: false }>();
  if (!data) return { error: "Contact not found." };

  // Fill in any merge fields typed by hand, so nothing like {{first_name}} ever reaches the timeline.
  const values = mergeValuesFor(
    { ...data, companyName: data.companies?.name, ownerName: data.profiles?.full_name },
    profile.full_name
  );
  const subject = renderTemplate(subjectRaw, values);
  const body = renderTemplate(bodyRaw, values);

  const res = await recordActivity({
    supabase, userId: profile.id, contactId, type: "email", outcome: "Sent",
    notes: `Subject: ${subject}\n\n${body}`,
    nextStep: clean(formData.get("next_step")), followUpDate: clean(formData.get("follow_up_date")),
  });
  if (res.error) return { error: res.error };
  redirect(`/contacts/${contactId}`);
}
