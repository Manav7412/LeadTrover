import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FIELD_TYPES, STANDARD_OBJECTS } from "@/lib/objects";
import { CUSTOMIZABLE, getCustomFields, type Customizable } from "@/lib/custom-fields";
import { EditFieldForm, FieldForm } from "@/components/ObjectForms";
import { addStandardField, deleteStandardField, updateField } from "../../actions";

export default async function StandardObjectPage({ params, searchParams }: PageProps<"/settings/objects/standard/[name]">) {
  const { name } = await params;
  const sp = await searchParams;
  const obj = STANDARD_OBJECTS.find((o) => o.table === name);
  if (!obj) notFound();
  const { supabase, profile } = await requireProfile();
  const canManage = can(profile, "objects.manage");
  const customizable = (CUSTOMIZABLE as readonly string[]).includes(obj.table);
  const custom = customizable ? await getCustomFields(supabase, obj.table as Customizable) : [];
  const back = `/settings/objects/standard/${obj.table}`;
  const editing = canManage ? custom.find((f) => f.id === sp.edit) : undefined;
  const typeLabel = (t: string) => FIELD_TYPES.find((x) => x.key === t)?.label ?? t;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings/objects" className="text-sm text-slate-500 hover:text-accent">← All objects</Link>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{obj.name} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-600">Standard</span></h2>
          <p className="text-sm text-slate-500">{obj.description}</p>
        </div>
        <Link href={obj.href} className="btn-secondary">Open {obj.name.toLowerCase()}</Link>
      </div>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">Built-in fields</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">These come with LeadTrove and can&apos;t be changed.</p>
        <div className="flex flex-wrap gap-2">
          {obj.fields.map((f) => <span key={f} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm text-slate-700">{f}</span>)}
        </div>
      </section>

      {!customizable ? (
        <p className="rounded-xl bg-slate-50 px-5 py-4 text-sm text-slate-500">Custom fields can be added to Contacts and Deals. {obj.name} keeps its built-in fields for now.</p>
      ) : (
        <>
          <section className="card overflow-hidden">
            <div className="p-5 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Your custom fields</h3>
              <p className="mt-0.5 text-sm text-slate-500">They appear on the {obj.name.toLowerCase().replace(/s$/, "")} form and page for everyone.</p>
            </div>
            {custom.length === 0 ? (
              <p className="border-t border-slate-100 p-8 text-center text-sm text-slate-500">No custom fields yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-2.5 font-medium">Field</th><th className="px-3 py-2.5 font-medium">Type</th><th className="px-3 py-2.5 font-medium">Required</th><th className="px-5 py-2.5" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {custom.map((f) => (
                    <tr key={f.id}>
                      <td className="px-5 py-2.5 font-medium text-slate-800">{f.label}</td>
                      <td className="px-3 py-2.5 text-slate-600">{typeLabel(f.type)}{f.type === "dropdown" && <span className="text-xs text-slate-400"> · {f.options.join(", ")}</span>}</td>
                      <td className="px-3 py-2.5 text-slate-600">{f.required ? "Yes" : "No"}</td>
                      <td className="px-5 py-2.5 text-right">
                        {canManage && (
                          <div className="flex justify-end gap-3 text-xs">
                            <Link href={`${back}?edit=${f.id}`} className="text-slate-400 hover:text-accent">Edit</Link>
                            <form action={deleteStandardField.bind(null, obj.table, f.id)}><button className="text-slate-400 hover:text-red-600">Delete</button></form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {editing ? (
            <section key={editing.id} className="card border-accent p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Edit “{editing.label}”</h3>
              <EditFieldForm action={updateField.bind(null, back, editing.id)} field={editing} cancelHref={back} />
            </section>
          ) : canManage && (
            <section className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Add a custom field</h3>
              <FieldForm action={addStandardField.bind(null, obj.table)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
