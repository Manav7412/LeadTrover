import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { DENIED, can, seesAll } from "@/lib/permissions";
import type { CustomField, CustomObject } from "@/lib/objects";
import RecordForm from "@/components/RecordForm";
import { createRecord } from "../actions";

export default async function NewRecordPage({ params }: PageProps<"/objects/[slug]/new">) {
  const { slug } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "records.edit")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: obj } = await supabase.from("custom_objects").select("id, name, plural, slug, description").eq("slug", slug).maybeSingle<CustomObject>();
  if (!obj) notFound();
  const [{ data: fields }, { data: team }] = await Promise.all([
    supabase.from("custom_fields").select("id, object_id, label, key, type, options, required, position").eq("object_id", obj.id).order("position").overrideTypes<CustomField[], { merge: false }>(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Add {obj.name.toLowerCase()}</h1>
      <RecordForm action={createRecord.bind(null, slug)} fields={fields ?? []} owners={seesAll(profile) ? team ?? [] : undefined} ownerId={profile.id} cancelHref={`/objects/${slug}`} />
    </div>
  );
}
