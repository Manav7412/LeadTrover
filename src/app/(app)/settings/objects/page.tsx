import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { STANDARD_OBJECTS, type CustomObject } from "@/lib/objects";
import { ObjectForm } from "@/components/ObjectForms";
import { createObject } from "./actions";

export default async function ObjectsPage() {
  const { supabase, profile } = await requireProfile();
  const canManage = can(profile, "objects.manage");

  const [{ data: custom, error }, ...counts] = await Promise.all([
    supabase.from("custom_objects").select("id, name, plural, slug, description").order("created_at").overrideTypes<CustomObject[], { merge: false }>(),
    ...STANDARD_OBJECTS.map((o) => supabase.from(o.table).select("id", { count: "exact", head: true })),
  ]);
  const customCounts = await Promise.all(
    (custom ?? []).map((o) => supabase.from("custom_records").select("id", { count: "exact", head: true }).eq("object_id", o.id)),
  );

  const { data: extraRows } = await supabase.from("custom_fields").select("standard_object").not("standard_object", "is", null);
  const extra: Record<string, number> = {};
  for (const r of extraRows ?? []) extra[r.standard_object] = (extra[r.standard_object] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold text-slate-900">Standard objects</h2>
          <p className="mt-0.5 text-sm text-slate-500">What LeadTrove stores out of the box. Click Contacts or Deals to add your own fields, such as Address or Postal Code.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-2.5 font-medium">Object</th><th className="px-3 py-2.5 font-medium">Fields</th><th className="px-3 py-2.5 text-right font-medium">Records</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STANDARD_OBJECTS.map((o, i) => (
              <tr key={o.table} className="align-top hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/settings/objects/standard/${o.table}`} className="font-medium text-slate-900 hover:text-accent">{o.name}</Link>
                  <p className="text-xs text-slate-500">{o.description}</p>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">
                  {o.fields.join(" · ")}
                  {(extra[o.table] ?? 0) > 0 && <span className="ml-1 font-medium text-accent">+ {extra[o.table]} custom</span>}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">{counts[i].count ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Custom objects</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">Track anything else your team needs, such as properties, projects or vehicles, with your own fields.</p>
        {error ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Custom objects aren&apos;t set up yet. Run <code>supabase/objects.sql</code> in the Supabase SQL Editor first.</p>
        ) : (custom ?? []).length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No custom objects yet.{canManage ? " Create your first one below." : ""}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(custom ?? []).map((o, i) => (
              <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{o.plural}</p>
                <p className="text-xs text-slate-500">{o.description ?? "No description"}</p>
                <p className="mt-2 text-xs text-slate-500">{customCounts[i].count ?? 0} records</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <Link href={`/objects/${o.slug}`} className="font-medium text-accent hover:underline">Open records</Link>
                  <Link href={`/settings/objects/${o.id}`} className="text-slate-600 hover:text-accent">{canManage ? "Edit fields" : "View fields"}</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManage && !error && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Create a custom object</h2>
          <ObjectForm action={createObject} submitLabel="Create object" />
          <p className="mt-3 text-xs text-slate-500">You&apos;ll add its fields on the next screen.</p>
        </section>
      )}
    </div>
  );
}
