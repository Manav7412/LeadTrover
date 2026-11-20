import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import PipelineForm from "@/components/PipelineForm";
import DeletePipelineButton from "@/components/DeletePipelineButton";
import type { StageOutcome } from "@/lib/deals";
import { DENIED, can } from "@/lib/permissions";
import { updatePipeline, deletePipeline } from "../../actions";

export default async function EditPipelinePage({ params }: PageProps<"/pipelines/[id]/edit">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "pipelines.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: pipeline } = await supabase.from("pipelines").select("id, name").eq("id", id).maybeSingle();
  if (!pipeline) notFound();
  const { data: stages } = await supabase.from("stages").select("id, name, outcome").eq("pipeline_id", id).order("position");

  return (
    <div>
      <Link href={`/pipelines?p=${id}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to board</Link>
      <div className="mb-5 mt-1 flex max-w-2xl items-start justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Edit pipeline</h1>
        <DeletePipelineButton action={deletePipeline.bind(null, id)} name={pipeline.name} />
      </div>
      <PipelineForm
        action={updatePipeline.bind(null, id)}
        defaults={{ name: pipeline.name, stages: (stages ?? []) as { id: string; name: string; outcome: StageOutcome }[] }}
        submitLabel="Save changes"
        cancelHref={`/pipelines?p=${id}`}
      />
    </div>
  );
}
