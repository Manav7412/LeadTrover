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

// Called when a card is dropped on a new column.
export async function moveDeal(dealId: string, stageId: string): Promise<{ error?: string; notice?: string }> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "deals.edit")) return { error: DENIED };
  const { data: stage } = await supabase.from("stages").select("name, pipeline_id, outcome").eq("id", stageId).single();
  if (!stage) return { error: "Stage not found." };
  const { data, error } = await supabase
    .from("deals")
    .update({ stage_id: stageId, pipeline_id: stage.pipeline_id, status: stage.outcome })
    .eq("id", dealId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can't move this deal." };
  revalidatePath("/pipelines");
  revalidatePath("/tasks");
  // Moving a Sales deal to Won makes the database create an onboarding deal. Tell the user.
  if (stage.outcome === "won") {
    const { data: onboarding } = await supabase.from("deals").select("title").eq("source_deal_id", dealId).limit(1).maybeSingle();
    if (onboarding) return { notice: `Deal won! "${onboarding.title}" was added to Client Onboarding (Signed), with a task to book the kickoff.` };
  }
  return {};
}

async function readDeal(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const title = clean(formData.get("title"));
  const stage_id = clean(formData.get("stage_id"));
  if (!title) return { error: "Give the deal a title." } as const;
  if (!stage_id) return { error: "Choose a stage." } as const;

  const { data: stage } = await supabase.from("stages").select("name, pipeline_id, outcome").eq("id", stage_id).single();
  if (!stage) return { error: "Stage not found." } as const;

  const contact_id = clean(formData.get("contact_id"));
  let company_id: string | null = null;
  if (contact_id) {
    const { data: c } = await supabase.from("contacts").select("company_id").eq("id", contact_id).maybeSingle();
    company_id = c?.company_id ?? null;
  }
  const value = Number(clean(formData.get("value")) ?? 0);
  if (!Number.isFinite(value) || value < 0) return { error: "Value must be a positive number." } as const;

  return {
    supabase, profile,
    values: { title, value, contact_id, company_id, stage_id, pipeline_id: stage.pipeline_id, status: stage.outcome },
  } as const;
}

export async function createDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const d = await readDeal(formData);
  if ("error" in d) return { error: d.error };
  if (!can(d.profile, "deals.create")) return { error: DENIED };
  const owner_id = d.profile.scope === "all" ? clean(formData.get("owner_id")) ?? d.profile.id : d.profile.id;
  const { error } = await d.supabase.from("deals").insert({ ...d.values, owner_id });
  if (error) return { error: error.message };
  revalidatePath("/pipelines");
  redirect(`/pipelines?p=${d.values.pipeline_id}`);
}

export async function updateDeal(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const d = await readDeal(formData);
  if ("error" in d) return { error: d.error };
  if (!can(d.profile, "deals.edit")) return { error: DENIED };
  const changes: Record<string, unknown> = { ...d.values };
  if (d.profile.scope === "all") changes.owner_id = clean(formData.get("owner_id"));
  const { error } = await d.supabase.from("deals").update(changes).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/pipelines");
  redirect(`/pipelines?p=${d.values.pipeline_id}`);
}

export async function deleteDeal(id: string, pipelineId: string) {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "deals.delete")) return;
  await supabase.from("deals").delete().eq("id", id);
  revalidatePath("/pipelines");
  redirect(`/pipelines?p=${pipelineId}`);
}

// ---------- Custom pipelines ----------

// Pipelines the automations rely on by name. They can be edited, but not renamed or deleted.
const PROTECTED = ["Sales", "Client Onboarding"];

type StageInput = { id?: string; name: string; outcome: "open" | "won" | "lost" };

function readPipeline(formData: FormData) {
  const name = clean(formData.get("name"));
  if (!name) return { error: "Give the pipeline a name." } as const;
  if (name.length > 60) return { error: "The pipeline name is too long (60 characters max)." } as const;

  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("stages") ?? "[]")); } catch { raw = []; }
  const stages: StageInput[] = (Array.isArray(raw) ? raw : [])
    .map((s) => ({
      id: typeof s?.id === "string" ? s.id : undefined,
      name: String(s?.name ?? "").trim(),
      outcome: (["won", "lost"].includes(s?.outcome) ? s.outcome : "open") as StageInput["outcome"],
    }));
  if (stages.length === 0) return { error: "Add at least one stage." } as const;
  if (stages.length > 12) return { error: "A pipeline can have up to 12 stages." } as const;
  if (stages.some((s) => !s.name)) return { error: "Every stage needs a name." } as const;
  if (stages.some((s) => s.name.length > 40)) return { error: "Stage names can be 40 characters at most." } as const;
  const lower = stages.map((s) => s.name.toLowerCase());
  if (new Set(lower).size !== lower.length) return { error: "Two stages have the same name." } as const;
  return { name, stages } as const;
}

const dbMessage = (error: { code?: string; message: string }) =>
  error.code === "23505" ? "A pipeline with that name already exists." :
  error.code === "23503" ? "Some deals are still in this stage or pipeline. Move or delete them first." :
  error.message;

export async function createPipeline(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "pipelines.manage")) return { error: DENIED };
  const p = readPipeline(formData);
  if ("error" in p) return { error: p.error };

  const { data: last } = await supabase.from("pipelines").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data: pipeline, error } = await supabase.from("pipelines").insert({ name: p.name, position: (last?.position ?? 0) + 1 }).select("id").single();
  if (error) return { error: dbMessage(error) };

  const { error: stageError } = await supabase.from("stages").insert(
    p.stages.map((s, i) => ({ pipeline_id: pipeline.id, name: s.name, position: i + 1, outcome: s.outcome }))
  );
  if (stageError) {
    await supabase.from("pipelines").delete().eq("id", pipeline.id);
    return { error: dbMessage(stageError) };
  }
  revalidatePath("/pipelines");
  redirect(`/pipelines?p=${pipeline.id}`);
}

export async function updatePipeline(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "pipelines.manage")) return { error: DENIED };
  const p = readPipeline(formData);
  if ("error" in p) return { error: p.error };

  const { data: current } = await supabase.from("pipelines").select("name").eq("id", id).maybeSingle();
  if (!current) return { error: "Pipeline not found." };
  if (PROTECTED.includes(current.name) && current.name !== p.name) {
    return { error: `"${current.name}" is used by LeadTrove's automations, so it can't be renamed. You can still change its stages.` };
  }
  const { data: existing } = await supabase.from("stages").select("id").eq("pipeline_id", id);
  const existingIds = new Set((existing ?? []).map((s) => s.id));
  const kept = new Set(p.stages.filter((s) => s.id && existingIds.has(s.id)).map((s) => s.id));
  const removed = [...existingIds].filter((sid) => !kept.has(sid));

  if (removed.length > 0) {
    const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).in("stage_id", removed);
    if (count) return { error: "A stage you removed still has deals in it. Move those deals to another stage first." };
  }

  const { error: renameError } = await supabase.from("pipelines").update({ name: p.name }).eq("id", id);
  if (renameError) return { error: dbMessage(renameError) };

  for (const [i, s] of p.stages.entries()) {
    const result = s.id && existingIds.has(s.id)
      ? await supabase.from("stages").update({ name: s.name, outcome: s.outcome, position: i + 1 }).eq("id", s.id)
      : await supabase.from("stages").insert({ pipeline_id: id, name: s.name, outcome: s.outcome, position: i + 1 });
    if (result.error) return { error: dbMessage(result.error) };
  }
  if (removed.length > 0) {
    const { error } = await supabase.from("stages").delete().in("id", removed);
    if (error) return { error: dbMessage(error) };
  }
  revalidatePath("/pipelines");
  redirect(`/pipelines?p=${id}`);
}

export async function deletePipeline(id: string): Promise<FormState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "pipelines.manage")) return { error: DENIED };
  const { data: current } = await supabase.from("pipelines").select("name").eq("id", id).maybeSingle();
  if (!current) return { error: "Pipeline not found." };
  if (PROTECTED.includes(current.name)) return { error: `"${current.name}" is used by LeadTrove's automations, so it can't be deleted.` };
  const { error } = await supabase.from("pipelines").delete().eq("id", id);
  if (error) return { error: error.code === "23503" ? "This pipeline still has deals. Move or delete them first." : error.message };
  revalidatePath("/pipelines");
  redirect("/pipelines");
}
