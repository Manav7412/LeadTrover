import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import ContactForm from "@/components/ContactForm";
import { updateContact } from "../../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "contacts.edit")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const { data: c } = await supabase.from("contacts").select("*, companies(name)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: companies }, { data: team }] = await Promise.all([
    supabase.from("companies").select("name").order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <div>
      <Link href={`/contacts/${id}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to contact</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Edit {c.first_name} {c.last_name}</h1>
      <ContactForm
        action={updateContact.bind(null, id)}
        defaults={{ ...c, company: c.companies?.name ?? "" }}
        companies={(companies ?? []).map((x) => x.name)}
        team={team ?? []}
        isOwner={profile.scope === "all"}
        currentUserId={profile.id}
        submitLabel="Save changes"
        cancelHref={`/contacts/${id}`}
      />
    </div>
  );
}
