import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import LeadFormEditor from "@/components/LeadFormEditor";
import { createForm } from "../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function NewFormPage() {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "forms.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: team } = await supabase.from("profiles").select("id, full_name").order("full_name");
  return (
    <div>
      <Link href="/forms" className="text-sm text-slate-500 hover:text-slate-800">← Forms</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">New form</h1>
      <LeadFormEditor action={createForm} team={team ?? []} submitLabel="Create form" />
    </div>
  );
}
