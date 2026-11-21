"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth";
import { STATUSES, type FormState } from "@/lib/contacts";
import { DENIED, can } from "@/lib/permissions";
import { getCustomFields, readCustomData } from "@/lib/custom-fields";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

const parseTags = (s: string | null) =>
  [...new Set((s ?? "").split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))];

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Finds a company by name (ignoring capitals) or creates it.
async function resolveCompany(supabase: SupabaseClient, name: string | null) {
  if (!name) return null;
  const escaped = name.replace(/[\\%_]/g, "\\$&");
  const { data: found } = await supabase.from("companies").select("id").ilike("name", escaped).limit(1).maybeSingle();
  if (found) return found.id as string;
  const { data, error } = await supabase.from("companies").insert({ name }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

// Turns a database error into a plain-English message.
function friendlyError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    if (error.message.includes("email")) return "A contact with this email already exists.";
    if (error.message.includes("phone")) return "A contact with this phone number already exists.";
    return "This contact already exists.";
  }
  return error.message;
}

async function readForm(formData: FormData, supabase: SupabaseClient) {
  const first_name = clean(formData.get("first_name"));
  const email = clean(formData.get("email"));
  if (!first_name) return { error: "First name is required." } as const;
  if (email && !looksLikeEmail(email)) return { error: "That email address doesn't look right." } as const;
  const status = String(formData.get("status") ?? "new");
  const company_id = await resolveCompany(supabase, clean(formData.get("company")));
  const customFields = await getCustomFields(supabase, "contacts");
  const custom = readCustomData(customFields, formData);
  if ("error" in custom) return { error: custom.error } as const;
  return {
    values: {
      ...(customFields.length ? { custom: custom.data } : {}),
      first_name,
      last_name: clean(formData.get("last_name")) ?? "",
      email,
      phone: clean(formData.get("phone")),
      company_id,
      source: clean(formData.get("source")) ?? "Manual",
      status: (STATUSES as readonly string[]).includes(status) ? status : "new",
      tags: parseTags(clean(formData.get("tags"))),
    },
  } as const;
}

export async function createContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "contacts.create")) return { error: DENIED };
  const parsed = await readForm(formData, supabase);
  if ("error" in parsed) return { error: parsed.error };
  // A Rep always owns what they add. An Owner picks an owner, or leaves it on
  // "Auto-assign" and the database gives the lead to whoever has the fewest open leads.
  const owner_id = profile.scope === "all" ? clean(formData.get("owner_id")) : profile.id;
  const { data, error } = await supabase.from("contacts").insert({ ...parsed.values, owner_id }).select("id").single();
  if (error) return { error: friendlyError(error) };
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}${owner_id ? "" : "?auto=1"}`);
}

export async function updateContact(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "contacts.edit")) return { error: DENIED };
  const parsed = await readForm(formData, supabase);
  if ("error" in parsed) return { error: parsed.error };
  const changes: Record<string, unknown> = { ...parsed.values };
  if (profile.scope === "all") changes.owner_id = clean(formData.get("owner_id"));
  const { error } = await supabase.from("contacts").update(changes).eq("id", id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "contacts.delete")) return;
  // remove the contact's attached files from storage first (the database rows go with the contact)
  const { data: attached } = await supabase.from("contact_files").select("storage_path").eq("contact_id", id);
  if (attached?.length) await supabase.storage.from("contact-files").remove(attached.map((f) => f.storage_path as string));
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath("/contacts");
  redirect("/contacts");
}

// ---------- CSV import ----------

export type ImportRow = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: string;
  tags: string;
};

export type ImportResult = {
  imported: number;
  duplicates: { line: number; name: string; reason: string }[];
  invalid: { line: number; name: string; reason: string }[];
};

export async function importContacts(rows: ImportRow[]): Promise<ImportResult> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "contacts.import")) return { imported: 0, duplicates: [], invalid: [{ line: 0, name: "Import", reason: DENIED }] };
  const result: ImportResult = { imported: 0, duplicates: [], invalid: [] };
  const companyCache = new Map<string, string | null>();

  for (const [i, row] of rows.slice(0, 500).entries()) {
    const line = i + 2; // line 1 of the file is the header
    const name = `${row.first_name} ${row.last_name}`.trim() || row.email || "(blank row)";
    const email = row.email.trim() || null;
    if (!row.first_name.trim()) { result.invalid.push({ line, name, reason: "Missing first name" }); continue; }
    if (email && !looksLikeEmail(email)) { result.invalid.push({ line, name, reason: "Invalid email" }); continue; }

    const companyName = row.company.trim();
    let company_id: string | null = null;
    if (companyName) {
      const key = companyName.toLowerCase();
      if (!companyCache.has(key)) companyCache.set(key, await resolveCompany(supabase, companyName));
      company_id = companyCache.get(key) ?? null;
    }
    const status = row.status.trim().toLowerCase();
    const { error } = await supabase.from("contacts").insert({
      first_name: row.first_name.trim(),
      last_name: row.last_name.trim(),
      email,
      phone: row.phone.trim() || null,
      company_id,
      owner_id: profile.scope === "all" ? null : profile.id, // Owner imports are shared out automatically
      source: row.source.trim() || "CSV import",
      status: (STATUSES as readonly string[]).includes(status) ? status : "new",
      tags: parseTags(row.tags.trim() || null),
    });
    if (!error) { result.imported++; continue; }
    if (error.code === "23505") result.duplicates.push({ line, name, reason: friendlyError(error).replace(/^A contact with this /, "Same ").replace(" already exists.", "") });
    else result.invalid.push({ line, name, reason: error.message });
  }
  revalidatePath("/contacts");
  return result;
}
