"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { DENIED, can, seesAll } from "@/lib/permissions";
import type { CustomField } from "@/lib/objects";
import type { FormState } from "@/lib/contacts";
import { readCustomData } from "@/lib/custom-fields";

const readData = readCustomData;

async function load(slug: string) {
  const ctx = await requireProfile();
  if (!can(ctx.profile, "records.edit")) return { error: DENIED } as const;
  const { data: obj } = await ctx.supabase.from("custom_objects").select("id").eq("slug", slug).maybeSingle();
  if (!obj) return { error: "That object no longer exists." } as const;
  const { data: fields } = await ctx.supabase.from("custom_fields").select("id, object_id, label, key, type, options, required, position").eq("object_id", obj.id).overrideTypes<CustomField[], { merge: false }>();
  return { ...ctx, objectId: obj.id as string, fields: fields ?? [] } as const;
}

export async function createRecord(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const c = await load(slug);
  if ("error" in c) return { error: c.error };
  const parsed = readData(c.fields, fd);
  if ("error" in parsed) return { error: parsed.error };
  const owner = seesAll(c.profile) && fd.get("owner_id") ? String(fd.get("owner_id")) : c.profile.id;
  const { error } = await c.supabase.from("custom_records").insert({ object_id: c.objectId, owner_id: owner, data: parsed.data });
  if (error) return { error: error.message };
  revalidatePath(`/objects/${slug}`);
  redirect(`/objects/${slug}`);
}

export async function updateRecord(slug: string, id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const c = await load(slug);
  if ("error" in c) return { error: c.error };
  const parsed = readData(c.fields, fd);
  if ("error" in parsed) return { error: parsed.error };
  const values: Record<string, unknown> = { data: parsed.data, updated_at: new Date().toISOString() };
  if (seesAll(c.profile) && fd.get("owner_id")) values.owner_id = String(fd.get("owner_id"));
  const { error } = await c.supabase.from("custom_records").update(values).eq("id", id).eq("object_id", c.objectId);
  if (error) return { error: error.message };
  revalidatePath(`/objects/${slug}`);
  redirect(`/objects/${slug}`);
}

export async function deleteRecord(slug: string, id: string) {
  const c = await load(slug);
  if ("error" in c) return;
  await c.supabase.from("custom_records").delete().eq("id", id).eq("object_id", c.objectId);
  revalidatePath(`/objects/${slug}`);
  redirect(`/objects/${slug}`);
}
