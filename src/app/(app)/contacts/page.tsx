import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { STATUS_STYLES, timeAgo } from "@/lib/contacts";
import { applyContactFilters } from "@/lib/contact-filters";
import { can } from "@/lib/permissions";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  tags: string[];
  is_stale: boolean;
  last_activity_at: string | null;
  companies: { name: string } | null;
  profiles: { full_name: string } | null;
};

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = pick("q").trim();
  const status = pick("status");
  const tag = pick("tag");
  const owner = pick("owner");

  const { supabase, profile } = await requireProfile();
  const staleOnly = pick("stale") === "1";
  await supabase.rpc("refresh_stale_leads"); // automation: flag leads with no activity for 7 days

  // Row-level security in the database already hides other reps' contacts from a Rep.
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, status, tags, is_stale, last_activity_at, companies(name), profiles:owner_id(full_name)")
    .order("created_at", { ascending: false });

  query = applyContactFilters(query, { q, status, tag, owner, staleOnly }, profile.scope === "all");

  const [{ data, error }, { data: tagSource }, { data: team }] = await Promise.all([
    query.overrideTypes<ContactRow[], { merge: false }>(),
    supabase.from("contacts").select("tags"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const contacts = data ?? [];
  // Latest "next step" for each contact shown (newest activity that has one).
  const nextSteps = new Map<string, string>();
  if (contacts.length > 0) {
    const { data: acts } = await supabase
      .from("activities")
      .select("contact_id, next_step")
      .in("contact_id", contacts.map((c) => c.id))
      .not("next_step", "is", null)
      .order("created_at", { ascending: false });
    for (const a of acts ?? []) if (!nextSteps.has(a.contact_id)) nextSteps.set(a.contact_id, a.next_step);
  }
  // how many files are attached to each contact shown (empty until supabase/files.sql has been run)
  const fileCounts = new Map<string, number>();
  if (contacts.length > 0) {
    const { data: attached } = await supabase.from("contact_files").select("contact_id").in("contact_id", contacts.map((c) => c.id));
    for (const f of attached ?? []) fileCounts.set(f.contact_id as string, (fileCounts.get(f.contact_id as string) ?? 0) + 1);
  }
  const allTags = [...new Set((tagSource ?? []).flatMap((r) => r.tags as string[]))].sort();
  const filtered = Boolean(q || status || tag || owner || staleOnly);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {profile.scope === "all" ? "Everyone's contacts" : "Your contacts"}
          </p>
        </div>
        <div className="flex gap-2">
          {can(profile, "contacts.export") && <a href={`/export/contacts?${new URLSearchParams(Object.entries({ q, status, tag, owner, stale: staleOnly ? "1" : "" }).filter(([, v]) => v)).toString()}`} className="btn-secondary" download>
            Export CSV{filtered ? " (filtered)" : ""}
          </a>}
          {can(profile, "contacts.import") && <Link href="/contacts/import" className="btn-secondary">Import CSV</Link>}
          {can(profile, "contacts.create") && <Link href="/contacts/new" className="btn-primary">+ Add contact</Link>}
        </div>
      </div>

      <div className="card mt-5">
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <input name="q" defaultValue={q} placeholder="Search name, email or phone" className="input !w-72" />
          <select name="status" defaultValue={status} className="input !w-40">
            <option value="">All statuses</option>
            {Object.keys(STATUS_STYLES).map((s) => (
              <option key={s} value={s} className="capitalize">{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select name="tag" defaultValue={tag} className="input !w-40">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {profile.scope === "all" && (
            <select name="owner" defaultValue={owner} className="input !w-40">
              <option value="">All owners</option>
              {(team ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 px-1 text-sm text-slate-600">
            <input type="checkbox" name="stale" value="1" defaultChecked={staleOnly} className="h-4 w-4 accent-[#0b7f8c]" />
            Stale only
          </label>
          <button className="btn-primary">Apply</button>
          {filtered && <Link href="/contacts" className="btn-secondary">Clear</Link>}
          <span className="ml-auto rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
          </span>
        </form>

        {error ? (
          <p className="p-6 text-sm text-red-600">Could not load contacts: {error.message}</p>
        ) : contacts.length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-500">No contacts match. Try clearing your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Email / Phone</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tags</th>
                  <th className="px-4 py-3 font-medium">Next step</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                          {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
                        </span>
                        <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:text-accent">{c.first_name} {c.last_name}</Link>
                        {(fileCounts.get(c.id) ?? 0) > 0 && (
                          <Link href={`/contacts/${c.id}?tab=files`} title={`${fileCounts.get(c.id)} attached ${fileCounts.get(c.id) === 1 ? "file" : "files"}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-accent">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7" /></svg>
                            {fileCounts.get(c.id)}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.companies?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{c.email ?? "—"}</div>
                      {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.profiles?.full_name ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <Link key={t} href={`/contacts?tag=${encodeURIComponent(t)}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200">{t}</Link>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      {nextSteps.get(c.id) ? (
                        <span className="line-clamp-2 text-slate-700">{nextSteps.get(c.id)}</span>
                      ) : c.status === "customer" || c.status === "lost" ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Needs next step</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {timeAgo(c.last_activity_at)}
                      {c.is_stale && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Stale</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
