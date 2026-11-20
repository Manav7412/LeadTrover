import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FIELD_TYPES, type CustomField, type CustomObject } from "@/lib/objects";
import { EditFieldForm, FieldForm, ObjectForm } from "@/components/ObjectForms";
import { addField, deleteField, deleteObject, updateField, updateObject } from "../actions";

export default async function ObjectEditPage({ params, searchParams }: PageProps<"/settings/objects/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const canManage = can(profile, "objects.manage");

  const { data: obj } = await supabase.from("custom_objects").select("id, name, plural, slug, description").eq("id", id).maybeSingle<CustomObject>();
  if (!obj) notFound();
  const [{ data: fields }, { count }] = await Promise.all([
    supabase.from("custom_fields").select("id, object_id, label, key, type, options, required, position").eq("object_id", id).order("position").overrideTypes<CustomField[], { merge: false }>(),
    supabase.from("custom_records").select("id", { count: "exact", head: true }).eq("object_id", id),
  ]);
  const back = `/settings/objects/${id}`;
  const editing = canManage ? (fields ?? []).find((f) => f.id === sp.edit) : undefined;
  const typeLabel = (t: string) => FIELD_TYPES.find((x) => x.key === t)?.label ?? t;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings/objects" className="text-sm text-slate-500 hover:text-accent">← All objects</Link>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{obj.plural}</h2>
        </div>
        <Link href={`/objects/${obj.slug}`} className="btn-secondary">Open records ({count ?? 0})</Link>
      </div>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Details</h3>
        {canManage
          ? <ObjectForm action={updateObject.bind(null, obj.id)} defaults={obj} submitLabel="Save details" />
          : <p className="text-sm text-slate-600">{obj.name} / {obj.plural}. {obj.description}</p>}
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="text-sm font-semibold text-slate-900">Fields</h3>
          <p className="mt-0.5 text-sm text-slate-500">What you record about each {obj.name.toLowerCase()}. Every record also has an owner.</p>
        </div>
        {(fields ?? []).length === 0 ? (
          <p className="border-t border-slate-100 p-8 text-center text-sm text-slate-500">No fields yet. Add the first one below.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5 font-medium">Field</th><th className="px-3 py-2.5 font-medium">Type</th><th className="px-3 py-2.5 font-medium">Required</th><th className="px-5 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(fields ?? []).map((f) => (
                <tr key={f.id}>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{f.label}</td>
                  <td className="px-3 py-2.5 text-slate-600">{typeLabel(f.type)}{f.type === "dropdown" && <span className="text-xs text-slate-400"> · {f.options.join(", ")}</span>}</td>
                  <td className="px-3 py-2.5 text-slate-600">{f.required ? "Yes" : "No"}</td>
                  <td className="px-5 py-2.5 text-right">
                    {canManage && (
                      <div className="flex justify-end gap-3 text-xs">
                        <Link href={`${back}?edit=${f.id}`} className="text-slate-400 hover:text-accent">Edit</Link>
                        <form action={deleteField.bind(null, obj.id, f.id)}><button className="text-slate-400 hover:text-red-600">Delete</button></form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canManage && (
        <>
          {editing ? (
            <section key={editing.id} className="card border-accent p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Edit “{editing.label}”</h3>
              <EditFieldForm action={updateField.bind(null, back, editing.id)} field={editing} cancelHref={back} />
            </section>
          ) : (
            <section className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Add a field</h3>
              <FieldForm action={addField.bind(null, obj.id)} />
            </section>
          )}
          <section className="card border-red-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Delete this object</h3>
            <p className="mb-3 mt-0.5 text-sm text-slate-500">This permanently removes {obj.plural} and its {count ?? 0} records. It can&apos;t be undone.</p>
            <form action={deleteObject.bind(null, obj.id)}><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Delete {obj.plural}</button></form>
          </section>
        </>
      )}
    </div>
  );
}
