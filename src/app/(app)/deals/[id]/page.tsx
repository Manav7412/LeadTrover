import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import DealForm from "@/components/DealForm";
import DeleteContactButton from "@/components/DeleteContactButton";
import { updateDeal, deleteDeal } from "../../pipelines/actions";
import { DENIED, can } from "@/lib/permissions";

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (!deal) notFound();
  if (!can(profile, "deals.edit")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const [{ data: pipelines }, { data: stages }, { data: contacts }, { data: team }] = await Promise.all([
    supabase.from("pipelines").select("id, name").order("position"),
    supabase.from("stages").select("id, name, pipeline_id").order("position"),
    supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <div>
      <Link href={`/pipelines?p=${deal.pipeline_id}`} className="text-sm text-slate-500 hover:text-slate-800">← Pipelines</Link>
      <div className="mb-5 mt-1 flex max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Edit deal</h1>
        {can(profile, "deals.delete") && <DeleteContactButton label="deal" action={deleteDeal.bind(null, id, deal.pipeline_id)} />}
      </div>
      <DealForm
        action={updateDeal.bind(null, id)}
        pipelines={pipelines ?? []}
        stages={stages ?? []}
        contacts={(contacts ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }))}
        team={team ?? []}
        isOwner={profile.scope === "all"}
        currentUserId={profile.id}
        defaults={{ title: deal.title, value: Number(deal.value), contact_id: deal.contact_id, pipeline_id: deal.pipeline_id, stage_id: deal.stage_id, owner_id: deal.owner_id }}
        submitLabel="Save changes"
        cancelHref={`/pipelines?p=${deal.pipeline_id}`}
      />
    </div>
  );
}
