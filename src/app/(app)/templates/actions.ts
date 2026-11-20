"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { MERGE_FIELDS, unknownFields } from "@/lib/merge";
import type { FormState } from "@/lib/contacts";
import { DENIED, can } from "@/lib/permissions";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

async function read(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "templates.manage")) return { error: DENIED } as const;
  const name = clean(formData.get("name"));
  const subject = clean(formData.get("subject"));
  const body = String(formData.get("body") ?? "").trim();
  if (!name) return { error: "Give the template a name." } as const;
  if (!subject) return { error: "Add a subject line." } as const;
  if (!body) return { error: "Write the email body." } as const;
  if (name.length > 80 || subject.length > 200 || body.length > 10000) return { error: "That is too long. Shorten the name, subject or body." } as const;
  const bad = unknownFields(`${subject} ${body}`);
  if (bad.length) {
    return { error: `Unknown merge field${bad.length > 1 ? "s" : ""}: ${bad.map((b) => `{{${b}}}`).join(", ")}. Use: ${MERGE_FIELDS.map((f) => `{{${f.key}}}`).join(", ")}` } as const;
  }
  return { supabase, values: { name, subject, body } } as const;
}

export async function createTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await read(formData);
  if ("error" in t) return { error: t.error };
  const { error } = await t.supabase.from("email_templates").insert(t.values);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplate(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await read(formData);
  if ("error" in t) return { error: t.error };
  const { error } = await t.supabase.from("email_templates").update(t.values).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplate(id: string) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "templates.manage")) return;
  await supabase.from("email_templates").delete().eq("id", id);
  revalidatePath("/templates");
  redirect("/templates");
}
