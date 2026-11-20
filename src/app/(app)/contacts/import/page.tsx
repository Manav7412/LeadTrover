import Link from "next/link";
import ImportContacts from "@/components/ImportContacts";
import { requireProfile } from "@/lib/auth";
import { DENIED, can } from "@/lib/permissions";

export default async function ImportPage() {
  const { profile } = await requireProfile();
  if (!can(profile, "contacts.import")) return <p className="text-sm text-slate-500">{DENIED}</p>;
  return (
    <div>
      <Link href="/contacts" className="text-sm text-slate-500 hover:text-slate-800">← Contacts</Link>
      <h1 className="mb-5 mt-1 text-2xl font-semibold text-slate-900">Import contacts</h1>
      <ImportContacts />
    </div>
  );
}
