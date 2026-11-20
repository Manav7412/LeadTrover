import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import RoleEditor from "@/components/RoleEditor";
import { NewRoleForm } from "@/components/SettingsForms";
import { can, type DataScope } from "@/lib/permissions";
import { createRole, deleteRole, saveRole } from "../actions";

type RoleRow = { id: string; name: string; description: string | null; is_system: boolean; data_scope: DataScope; permissions: Record<string, boolean> };

export default async function RolesPage({ searchParams }: PageProps<"/settings/roles">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const [{ data, error }, { data: people }] = await Promise.all([
    supabase.from("roles").select("id, name, description, is_system, data_scope, permissions").order("created_at").overrideTypes<RoleRow[], { merge: false }>(),
    supabase.from("profiles").select("role_id"),
  ]);
  if (error) {
    return <div className="card p-8 text-sm text-slate-600">Roles aren&apos;t set up yet. Run <code>supabase/permissions.sql</code> in Supabase first.</div>;
  }
  const roles = data ?? [];
  const members = (id: string) => (people ?? []).filter((p) => p.role_id === id).length;
  const selected = roles.find((r) => r.id === sp.role) ?? roles.find((r) => r.id === profile.roleId) ?? roles[0];
  const canManage = can(profile, "roles.manage");

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Roles</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">A role decides what a person can see and do. Pick one to look at or change it.</p>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <Link
              key={r.id} href={`/settings/roles?role=${r.id}`}
              className={`rounded-xl border px-4 py-2.5 ${r.id === selected?.id ? "border-accent bg-accent-soft" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <span className="block text-sm font-medium text-slate-900">{r.name}</span>
              <span className="block text-xs text-slate-500">{members(r.id)} {members(r.id) === 1 ? "person" : "people"} · sees {r.data_scope === "all" ? "everyone's" : "own"} records</span>
            </Link>
          ))}
        </div>
      </section>

      {selected && (
        <div key={selected.id}>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{selected.name}</h2>
          {selected.description && <p className="-mt-2 mb-3 text-sm text-slate-500">{selected.description}</p>}
          <RoleEditor role={selected} canEdit={canManage} memberCount={members(selected.id)} save={saveRole.bind(null, selected.id)} remove={deleteRole.bind(null, selected.id)} />
        </div>
      )}

      {canManage && (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Create a new role</h2>
          <p className="mb-4 mt-0.5 text-sm text-slate-500">For example a Team Lead, an Assistant or a read-only Viewer.</p>
          <NewRoleForm action={createRole} roles={roles.map((r) => ({ id: r.id, name: r.name }))} />
        </section>
      )}
    </div>
  );
}
