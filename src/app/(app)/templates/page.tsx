import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { renderTemplate, sampleValues } from "@/lib/merge";
import { can } from "@/lib/permissions";

export default async function TemplatesPage() {
  const { supabase, profile } = await requireProfile();
  const canManage = can(profile, "templates.manage");
  const { data } = await supabase.from("email_templates").select("id, name, subject, body").order("created_at", { ascending: true });
  const templates = data ?? [];
  const sample = sampleValues();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Email templates</h1>
          <p className="mt-0.5 text-sm text-slate-500">Write an email once, with merge fields like {"{{first_name}}"}. Use it on any contact and it is logged on their timeline.</p>
        </div>
        {canManage && <Link href="/templates/new" className="btn-primary">+ New template</Link>}
      </div>

      {templates.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <p className="font-medium text-slate-900">No templates yet</p>
          {canManage && <Link href="/templates/new" className="btn-primary mt-4">+ New template</Link>}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="card flex flex-col p-5">
              <h2 className="font-semibold text-slate-900">{t.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Subject: {renderTemplate(t.subject, sample)}</p>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{renderTemplate(t.body, sample)}</p>
              {canManage && (
                <div className="mt-4 flex justify-end">
                  <Link href={`/templates/${t.id}/edit`} className="btn-secondary !py-1.5 text-xs">Edit</Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-400">Previews show an example contact (Sarah Mitchell). To use a template, open a contact and click Email.</p>
    </div>
  );
}
