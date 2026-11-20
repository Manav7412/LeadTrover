import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import ContactForm from "@/components/ContactForm";
import { createContact } from "../actions";
import { DENIED, can } from "@/lib/permissions";

export default async function NewContactPage() {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "contacts.create")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const [{ data: companies }, { data: team }] = await Promise.all([
    supabase.from("companies").select("name").order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <div>
      <Link href="/contacts" className="text-sm text-slate-500 hover:text-slate-800">← Contacts</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Add contact</h1>
      <ContactForm
        action={createContact}
        companies={(companies ?? []).map((c) => c.name)}
        team={team ?? []}
        isOwner={profile.scope === "all"}
        currentUserId={profile.id}
        autoAssign
        submitLabel="Add contact"
        cancelHref="/contacts"
      />
    </div>
  );
}
