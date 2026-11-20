import { requireProfile } from "@/lib/auth";
import { AddMemberForm, MemberControls } from "@/components/SettingsForms";
import { can, DENIED } from "@/lib/permissions";
import { addTeamMember, changeMemberRole, removeMember } from "../actions";

export default async function TeamSettingsPage() {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "team.manage")) {
    return <div className="card p-10 text-center text-sm text-slate-500">{DENIED}</div>;
  }

  const [{ data: members }, { data: roles }, { data: contacts }, { data: deals }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, role_id, job_title, roles(name)").order("created_at")
      .overrideTypes<{ id: string; full_name: string; email: string; role: string; role_id: string | null; job_title: string | null; roles: { name: string } | null }[], { merge: false }>(),
    supabase.from("roles").select("id, name, description").order("created_at"),
    supabase.from("contacts").select("owner_id").limit(5000),
    supabase.from("deals").select("owner_id").eq("status", "open").limit(5000),
  ]);
  const count = (rows: { owner_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.owner_id === id).length;
  // Only an Owner can assign the Owner role or touch an Owner
  const assignable = (roles ?? []).filter((r) => profile.isOwner || r.name !== "Owner");

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Team members</h2>
          <p className="mt-0.5 text-sm text-slate-500">What each person can do is set by their role. Create or change roles under Roles &amp; permissions.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {(members ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{m.full_name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {m.full_name} {m.id === profile.id && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">You</span>}
                  </p>
                  <p className="text-xs text-slate-500">{[m.job_title, m.email].filter(Boolean).join(" · ")}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{m.roles?.name ?? (m.role === "owner" ? "Owner" : "Rep")} · {count(contacts, m.id)} contacts · {count(deals, m.id)} open deals</p>
                </div>
              </div>
              <MemberControls
                userId={m.id} roleId={m.role_id} roles={assignable} isYou={m.id === profile.id}
                locked={m.role === "owner" && !profile.isOwner}
                changeRole={changeMemberRole} remove={removeMember}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Add a team member</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">They can sign in straight away with the email and starting password you set. Tell them to change it under Settings → Profile.</p>
        <AddMemberForm action={addTeamMember} roles={assignable} />
      </section>
    </div>
  );
}
