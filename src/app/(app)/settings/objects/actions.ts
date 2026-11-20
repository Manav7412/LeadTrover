"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { DENIED, can } from "@/lib/permissions";
import { FIELD_TYPES, slugify } from "@/lib/objects";
import { CUSTOMIZABLE, type Customizable } from "@/lib/custom-fields";
import type { MessageState } from "@/lib/contacts";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

async function requireManager() {
  const ctx = await requireProfile();
  if (!can(ctx.profile, "objects.manage")) throw new Error(DENIED);
  return ctx;
}

const RESERVED = ["new", "settings", "contacts", "deals", "tasks", "companies"];

export async function createObject(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { supabase, profile } = await requireManager();
  const name = clean(formData.get("name"));
  const plural = clean(formData.get("plural")) ?? (name ? name + "s" : null);
  const description = clean(formData.get("description"));
  if (!name || !plural) return { error: "Give the object a name, for example “Property”." };
  if (name.length > 40 || plural.length > 40 || (description?.length ?? 0) > 200) return { error: "That is too long. Shorten the name or description." };
  const slug = slugify(plural);
  if (!slug || RESERVED.includes(slug)) return { error: "Pick a different plural name. That one is already used." };
  const { data, error } = await supabase.from("custom_objects").insert({ name, plural, slug, description, created_by: profile.id }).select("id").single();
  if (error) return { error: error.code === "23505" ? "You already have an object with that name." : error.message };
  revalidatePath("/", "layout");
  redirect(`/settings/objects/${data.id}`);
}

export async function updateObject(id: string, _prev: MessageState, formData: FormData): Promise<MessageState> {
  const { supabase } = await requireManager();
  const name = clean(formData.get("name"));
  const plural = clean(formData.get("plural"));
  const description = clean(formData.get("description"));
  if (!name || !plural) return { error: "Name and plural name are both needed." };
  if (name.length > 40 || plural.length > 40 || (description?.length ?? 0) > 200) return { error: "That is too long. Shorten the name or description." };
  const { error } = await supabase.from("custom_objects").update({ name, plural, description }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function deleteObject(id: string) {
  const { supabase } = await requireManager();
  await supabase.from("custom_objects").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/settings/objects");
}

type Target = { objectId: string } | { standard: Customizable };

async function insertField(target: Target, formData: FormData): Promise<MessageState & { label?: string }> {
  const { supabase } = await requireManager();
  const label = clean(formData.get("label"));
  const type = String(formData.get("type") ?? "");
  if (!label) return { error: "Give the field a name, for example “Address”." };
  if (label.length > 60) return { error: "Field names must be 60 characters or fewer." };
  if (!FIELD_TYPES.some((t) => t.key === type)) return { error: "Pick a field type." };
  const options = type === "dropdown"
    ? [...new Set(String(formData.get("options") ?? "").split(/[\n,]/).map((o) => o.trim()).filter(Boolean))].slice(0, 30)
    : [];
  if (type === "dropdown" && options.length < 2) return { error: "A dropdown needs at least two choices, separated by commas." };

  const parent = "objectId" in target ? { object_id: target.objectId } : { standard_object: target.standard };
  const { data: existing } = await supabase.from("custom_fields").select("key, position").match(parent);
  const keys = new Set((existing ?? []).map((f) => f.key));
  const base = slugify(label).replace(/-/g, "_") || "field";
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;
  const position = Math.max(0, ...(existing ?? []).map((f) => f.position)) + 1;

  const { error } = await supabase.from("custom_fields").insert({ ...parent, label, key, type, options, required: formData.get("required") === "on" && type !== "yesno", position });
  if (error) return { error: error.message.includes("standard_object") ? "Run supabase/custom-fields.sql in Supabase first." : error.message };
  return { message: `Added “${label}”.` };
}

export async function addField(objectId: string, _prev: MessageState, formData: FormData): Promise<MessageState> {
  const res = await insertField({ objectId }, formData);
  if (res?.message) revalidatePath(`/settings/objects/${objectId}`);
  return res;
}

export async function addStandardField(standard: string, _prev: MessageState, formData: FormData): Promise<MessageState> {
  if (!(CUSTOMIZABLE as readonly string[]).includes(standard)) return { error: "Custom fields aren't available for that object." };
  const res = await insertField({ standard: standard as Customizable }, formData);
  if (res?.message) { revalidatePath(`/settings/objects/standard/${standard}`); revalidatePath("/contacts", "layout"); }
  return res;
}

export async function deleteStandardField(standard: string, fieldId: string) {
  const { supabase } = await requireManager();
  await supabase.from("custom_fields").delete().eq("id", fieldId).eq("standard_object", standard);
  revalidatePath(`/settings/objects/standard/${standard}`);
}

export async function deleteField(objectId: string, fieldId: string) {
  const { supabase } = await requireManager();
  await supabase.from("custom_fields").delete().eq("id", fieldId);
  revalidatePath(`/settings/objects/${objectId}`);
}
