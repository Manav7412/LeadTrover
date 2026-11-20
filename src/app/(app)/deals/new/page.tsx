import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import DealForm from "@/components/DealForm";
import { getCustomFields } from "@/lib/custom-fields";
import { createDeal } from "../../pipelines/actions";
import { DENIED, can } from "@/lib/permissions";

export default async function NewDealPage({ searchParams }: PageProps<"/deals/new">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "deals.create")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const [{ data: pipelines }, { data: stages }, { data: contacts }, { data: team }] = await Promise.all([
    supabase.from("pipelines").select("id, name").order("position"),
    supabase.from("stages").select("id, name, pipeline_id").order("position"),
    supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const pipelineId = (pipelines ?? []).find((p) => p.id === sp.p)?.id ?? pipelines?.[0]?.id ?? "";
  const stageId = (stages ?? []).find((s) => s.id === sp.s && s.pipeline_id === pipelineId)?.id ?? (stages ?? []).find((s) => s.pipeline_id === pipelineId)?.id ?? "";
  return (
    <div>
      <Link href={`/pipelines?p=${pipelineId}`} className="text-sm text-slate-500 hover:text-slate-800">← Pipelines</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Add deal</h1>
      <DealForm
        action={createDeal}
        pipelines={pipelines ?? []}
        stages={stages ?? []}
        contacts={(contacts ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }))}
        team={team ?? []}
        isOwner={profile.scope === "all"}
        currentUserId={profile.id}
        defaults={{ pipeline_id: pipelineId, stage_id: stageId }}
        customFields={await getCustomFields(supabase, "deals")}
        submitLabel="Add deal"
        cancelHref={`/pipelines?p=${pipelineId}`}
      />
    </div>
  );
}
