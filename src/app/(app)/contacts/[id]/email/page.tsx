import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import EmailComposer from "@/components/EmailComposer";
import { dateInput } from "@/lib/dates";
import { mergeValuesFor } from "@/lib/merge";
import { logEmail } from "./actions";
import { DENIED, can } from "@/lib/permissions";

type ContactRow = {
  first_name: string; last_name: string; email: string | null; phone: string | null;
  companies: { name: string } | null; profiles: { full_name: string } | null;
};

export default async function EmailContactPage({ params }: PageProps<"/contacts/[id]/email">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "activities.log")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  const [{ data: c }, { data: templates }] = await Promise.all([
    supabase.from("contacts").select("first_name, last_name, email, phone, companies(name), profiles:owner_id(full_name)").eq("id", id).maybeSingle()
      .overrideTypes<ContactRow, { merge: false }>(),
    supabase.from("email_templates").select("id, name, subject, body").order("created_at", { ascending: true }),
  ]);
  if (!c) notFound();
  const name = `${c.first_name} ${c.last_name}`.trim();
  const values = mergeValuesFor({ ...c, companyName: c.companies?.name, ownerName: c.profiles?.full_name }, profile.full_name);

  return (
    <div>
      <Link href={`/contacts/${id}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to {name}</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Email {name}</h1>
      <EmailComposer
        action={logEmail.bind(null, id)}
        templates={templates ?? []}
        values={values}
        toEmail={c.email}
        contactName={name}
        defaultFollowUp={dateInput(3)}
        cancelHref={`/contacts/${id}`}
      />
    </div>
  );
}
