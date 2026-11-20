import Link from "next/link";
import TemplateEditor from "@/components/TemplateEditor";
import { createTemplate } from "../actions";
import { requireProfile } from "@/lib/auth";
import { DENIED, can } from "@/lib/permissions";

export default async function NewTemplatePage() {
  const { profile } = await requireProfile();
  if (!can(profile, "templates.manage")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  return (
    <div>
      <Link href="/templates" className="text-sm text-slate-500 hover:text-slate-800">← Templates</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">New template</h1>
      <TemplateEditor action={createTemplate} submitLabel="Create template" />
    </div>
  );
}
