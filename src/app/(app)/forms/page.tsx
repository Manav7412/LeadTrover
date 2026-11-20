import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import CopyLink from "@/components/CopyLink";
import { can } from "@/lib/permissions";

type FormRow = {
  id: string; name: string; slug: string; is_active: boolean; submission_count: number; source: string; tags: string[];
  profiles: { full_name: string } | null;
};

export default async function FormsPage() {
  const { supabase, profile } = await requireProfile();

  if (!can(profile, "forms.manage")) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Forms</h1>
        <div className="card mt-6 p-10 text-center text-sm text-slate-500">
          You don&apos;t have permission to manage lead capture forms. New leads from forms are assigned automatically, and show up under Contacts and Tasks.
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("lead_forms")
    .select("id, name, slug, is_active, submission_count, source, tags, profiles:default_owner_id(full_name)")
    .order("created_at", { ascending: false })
    .overrideTypes<FormRow[], { merge: false }>();
  const forms = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Forms</h1>
          <p className="mt-0.5 text-sm text-slate-500">Public forms that turn website visitors into contacts, with an owner and a next step.</p>
        </div>
        <Link href="/forms/new" className="btn-primary">+ New form</Link>
      </div>

      {forms.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <p className="font-medium text-slate-900">No forms yet</p>
          <p className="mt-1 text-sm text-slate-500">Create a form, share its link, and every submission becomes a lead with an owner.</p>
          <Link href="/forms/new" className="btn-primary mt-4">+ New form</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {forms.map((f) => (
            <div key={f.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{f.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Assigns to {f.profiles?.full_name ?? "whoever has the fewest open leads"} · Source: {f.source}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${f.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {f.is_active ? "Live" : "Paused"}
                </span>
              </div>
              <div className="mt-4"><CopyLink path={`/f/${f.slug}`} /></div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-600"><b className="text-slate-900">{f.submission_count}</b> {f.submission_count === 1 ? "submission" : "submissions"}</p>
                <div className="flex gap-2">
                  <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 text-xs">Open form ↗</a>
                  <Link href={`/forms/${f.id}/edit`} className="btn-secondary !py-1.5 text-xs">Edit</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
