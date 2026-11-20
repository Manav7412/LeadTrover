import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LeadFormEditor from "@/components/LeadFormEditor";
import DeleteContactButton from "@/components/DeleteContactButton";
import { updateForm, deleteForm } from "../../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function EditFormPage({ params }: PageProps<"/forms/[id]/edit">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "forms.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: form } = await supabase.from("lead_forms").select("*").eq("id", id).maybeSingle();
  if (!form) notFound();
  const { data: team } = await supabase.from("profiles").select("id, full_name").order("full_name");
  return (
    <div>
      <Link href="/forms" className="text-sm text-slate-500 hover:text-slate-800">← Forms</Link>
      <div className="mb-5 mt-1 flex max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Edit form</h1>
        <DeleteContactButton label="form" action={deleteForm.bind(null, id)} />
      </div>
      <LeadFormEditor action={updateForm.bind(null, id)} team={team ?? []} defaults={form} submitLabel="Save changes" />
    </div>
  );
}
