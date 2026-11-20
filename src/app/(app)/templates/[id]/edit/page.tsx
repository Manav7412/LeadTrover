import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import TemplateEditor from "@/components/TemplateEditor";
import DeleteContactButton from "@/components/DeleteContactButton";
import { updateTemplate, deleteTemplate } from "../../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function EditTemplatePage({ params }: PageProps<"/templates/[id]/edit">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "templates.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: t } = await supabase.from("email_templates").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  return (
    <div>
      <Link href="/templates" className="text-sm text-slate-500 hover:text-slate-800">← Templates</Link>
      <div className="mb-5 mt-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Edit template</h1>
        <DeleteContactButton label="template" action={deleteTemplate.bind(null, id)} />
      </div>
      <TemplateEditor action={updateTemplate.bind(null, id)} defaults={t} submitLabel="Save changes" />
    </div>
  );
}
