import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { showValue, type CustomField, type CustomObject, type CustomRecord } from "@/lib/objects";
import { dayLabel, dateInputFrom } from "@/lib/dates";
import { deleteRecord } from "./actions";

const MAX_COLUMNS = 5;

export default async function ObjectRecordsPage({ params }: PageProps<"/objects/[slug]">) {
  const { slug } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: obj } = await supabase.from("custom_objects").select("id, name, plural, slug, description").eq("slug", slug).maybeSingle<CustomObject>();
  if (!obj) notFound();

  const [{ data: fields }, { data: records }, { data: team }] = await Promise.all([
    supabase.from("custom_fields").select("id, object_id, label, key, type, options, required, position").eq("object_id", obj.id).order("position").overrideTypes<CustomField[], { merge: false }>(),
    supabase.from("custom_records").select("id, object_id, owner_id, data, created_at").eq("object_id", obj.id).order("created_at", { ascending: false }).overrideTypes<CustomRecord[], { merge: false }>(),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const cols = (fields ?? []).slice(0, MAX_COLUMNS);
  const owner = new Map((team ?? []).map((p) => [p.id, p.full_name]));
  const canEdit = can(profile, "records.edit");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{obj.plural}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{obj.description ?? `Custom object · ${(records ?? []).length} records`}</p>
        </div>
        <div className="flex gap-2">
          {can(profile, "objects.manage") && <Link href={`/settings/objects/${obj.id}`} className="btn-secondary">Edit fields</Link>}
          {canEdit && (fields ?? []).length > 0 && <Link href={`/objects/${obj.slug}/new`} className="btn-primary">+ Add {obj.name.toLowerCase()}</Link>}
        </div>
      </div>

      <div className="card mt-5 overflow-hidden">
        {(fields ?? []).length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-500">
            This object has no fields yet.{" "}
            {can(profile, "objects.manage") ? <Link href={`/settings/objects/${obj.id}`} className="font-medium text-accent hover:underline">Add fields</Link> : "Ask an Owner to add some."}
          </p>
        ) : (records ?? []).length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-500">No {obj.plural.toLowerCase()} yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {cols.map((f) => <th key={f.id} className="px-4 py-3 font-medium">{f.label}</th>)}
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(records ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {cols.map((f, i) => (
                    <td key={f.id} className={`px-4 py-3 ${i === 0 ? "font-medium text-slate-900" : "text-slate-600"}`}>
                      {i === 0 && canEdit ? <Link href={`/objects/${obj.slug}/${r.id}`} className="hover:text-accent">{showValue(f, r.data[f.key])}</Link> : showValue(f, r.data[f.key])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-slate-600">{r.owner_id ? owner.get(r.owner_id) ?? "—" : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{dayLabel(dateInputFrom(r.created_at))}</td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex justify-end gap-3 text-xs">
                        <Link href={`/objects/${obj.slug}/${r.id}`} className="text-slate-400 hover:text-accent">Edit</Link>
                        <form action={deleteRecord.bind(null, obj.slug, r.id)}><button className="text-slate-400 hover:text-red-600">Delete</button></form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
