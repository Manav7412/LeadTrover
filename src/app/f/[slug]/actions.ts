"use server";

import { createClient } from "@/lib/supabase/server";

export type LeadFormState = { ok?: boolean; error?: string } | undefined;

// Public: no login needed. The database function checks everything and does the work.
export async function submitLead(slug: string, _prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  // Hidden "website" box: people never see it, bots fill it in. Pretend it worked and drop it.
  if (String(formData.get("website") ?? "").trim() !== "") return { ok: true };

  const text = (k: string) => String(formData.get(k) ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_lead_form", {
    form_slug: slug,
    p_first: text("first_name"),
    p_last: text("last_name"),
    p_email: text("email"),
    p_phone: text("phone"),
    p_company: text("company"),
    p_message: text("message"),
  });
  if (error) return { error: "Something went wrong. Please try again." };
  const res = data as { ok: boolean; error?: string };
  return res.ok ? { ok: true } : { error: res.error ?? "Something went wrong." };
}
