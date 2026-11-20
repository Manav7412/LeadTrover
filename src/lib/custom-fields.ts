// Custom fields on Contacts and Deals (Settings > Objects). Values are stored as JSON in the row's `custom` column.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomField } from "./objects";

export const CUSTOMIZABLE = ["contacts", "deals"] as const;
export type Customizable = (typeof CUSTOMIZABLE)[number];

const COLUMNS = "id, object_id, label, key, type, options, required, position";

// Empty list (not an error) if custom-fields.sql has not been run yet.
export async function getCustomFields(supabase: SupabaseClient, target: Customizable): Promise<CustomField[]> {
  const { data, error } = await supabase.from("custom_fields").select(COLUMNS).eq("standard_object", target).order("position");
  return error ? [] : ((data ?? []) as CustomField[]);
}

// Reads the f_<key> inputs of a submitted form and checks each by its type.
export function readCustomData(fields: CustomField[], fd: FormData): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = String(fd.get(`f_${f.key}`) ?? "").trim();
    if (f.type === "yesno") { data[f.key] = fd.get(`f_${f.key}`) === "on"; continue; }
    if (raw === "") {
      if (f.required) return { error: `“${f.label}” is required.` };
      continue;
    }
    if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: `“${f.label}” must be a number.` };
      data[f.key] = n;
    } else if (f.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: `“${f.label}” must be a date.` };
      data[f.key] = raw;
    } else if (f.type === "dropdown") {
      if (!f.options.includes(raw)) return { error: `Pick one of the choices for “${f.label}”.` };
      data[f.key] = raw;
    } else {
      if (raw.length > 500) return { error: `“${f.label}” is too long (500 characters at most).` };
      data[f.key] = raw;
    }
  }
  return { data };
}
