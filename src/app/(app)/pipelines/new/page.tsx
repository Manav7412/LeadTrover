import Link from "next/link";
import PipelineForm from "@/components/PipelineForm";
import { requireProfile } from "@/lib/auth";
import { DENIED, can } from "@/lib/permissions";
import { createPipeline } from "../actions";

export default async function NewPipelinePage() {
  const { profile } = await requireProfile();
  if (!can(profile, "pipelines.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  return (
    <div>
      <Link href="/pipelines" className="text-sm text-slate-500 hover:text-slate-800">← Pipelines</Link>
      <h1 className="mb-1 mt-1 text-2xl font-semibold text-slate-900">New pipeline</h1>
      <p className="mb-5 text-sm text-slate-500">Name it, then set the stages a deal moves through.</p>
      <PipelineForm action={createPipeline} showTemplates submitLabel="Create pipeline" cancelHref="/pipelines" />
    </div>
  );
}
