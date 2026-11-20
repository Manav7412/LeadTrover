import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { DENIED, can, seesAll } from "@/lib/permissions";
import type { CustomField, CustomObject, CustomRecord } from "@/lib/objects";
import RecordForm from "@/components/RecordForm";
import { updateRecord } from "../actions";

export default async function EditRecordPage({ params }: PageProps<"/objects/[slug]/[id]">) {
  const { slug, id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "records.edit")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: obj } = await supabase.from("custom_objects").select("id, name, plural, slug, description").eq("slug", slug).maybeSingle<CustomObject>();
  if (!obj) notFound();
  const [{ data: fields }, { data: record }, { data: team }] = await Promise.all([
    supabase.from("custom_fields").select("id, object_id, label, key, type, options, required, position").eq("object_id", obj.id).order("position").overrideTypes<CustomField[], { merge: false }>(),
    supabase.from("custom_records").select("id, object_id, owner_id, data, created_at").eq("id", id).eq("object_id", obj.id).maybeSingle<CustomRecord>(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  if (!record) notFound();
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Edit {obj.name.toLowerCase()}</h1>
      <RecordForm action={updateRecord.bind(null, slug, id)} fields={fields ?? []} values={record.data} owners={seesAll(profile) ? team ?? [] : undefined} ownerId={record.owner_id} cancelHref={`/objects/${slug}`} />
    </div>
  );
}
