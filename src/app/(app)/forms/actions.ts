"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import type { FormState } from "@/lib/contacts";
import { DENIED, can } from "@/lib/permissions";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
const parseTags = (s: string | null) =>
  [...new Set((s ?? "").split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))];

async function read(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "forms.manage")) return { error: DENIED } as const;
  const name = clean(formData.get("name"));
  if (!name) return { error: "Give the form a name." } as const;
  const slug = slugify(clean(formData.get("slug")) ?? name);
  if (!slug) return { error: "The web address needs letters or numbers." } as const;
  return {
    supabase,
    values: {
      name,
      slug,
      heading: clean(formData.get("heading")) ?? "Get in touch",
      description: clean(formData.get("description")),
      success_message: clean(formData.get("success_message")) ?? "Thanks! We'll be in touch shortly.",
      default_owner_id: clean(formData.get("default_owner_id")), // empty = auto-assign
      tags: parseTags(clean(formData.get("tags"))),
      source: clean(formData.get("source")) ?? "Website Form",
      is_active: formData.get("is_active") === "on",
    },
  } as const;
}

const friendly = (e: { code?: string; message: string }) => (e.code === "23505" ? "Another form already uses that web address. Choose a different one." : e.message);

export async function createForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const f = await read(formData);
  if ("error" in f) return { error: f.error };
  const { error } = await f.supabase.from("lead_forms").insert(f.values);
  if (error) return { error: friendly(error) };
  revalidatePath("/forms");
  redirect("/forms");
}

export async function updateForm(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const f = await read(formData);
  if ("error" in f) return { error: f.error };
  const { error } = await f.supabase.from("lead_forms").update(f.values).eq("id", id);
  if (error) return { error: friendly(error) };
  revalidatePath("/forms");
  redirect("/forms");
}

export async function deleteForm(id: string) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "forms.manage")) return;
  await supabase.from("lead_forms").delete().eq("id", id);
  revalidatePath("/forms");
  redirect("/forms");
}
