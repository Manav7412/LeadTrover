import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { legacyAccess, type Access } from "@/lib/permissions";

// `role` is the basic kind of login ("owner" or "rep"). What a person may actually do comes from
// their role's permissions and data scope (see lib/permissions.ts).
export type Profile = {
  id: string; full_name: string; email: string; role: "owner" | "rep";
  job_title: string | null; phone: string | null;
} & Access;

type RoleRow = { id: string; name: string; data_scope: "own" | "all"; permissions: Record<string, boolean> };

// Returns the logged-in user's profile (name + role + permissions), or sends them to /login.
export async function requireProfile() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("*, roles(id, name, data_scope, permissions)")
    .eq("id", auth.user.id)
    .maybeSingle();

  let base = row as (Record<string, unknown> & { roles?: RoleRow | null }) | null;
  if (!base) {
    // Fallback while the roles table has not been created yet.
    const { data: plain } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    base = plain as typeof base;
  }
  if (!base) redirect("/login");

  const isOwner = base.role === "owner";
  const r = base.roles;
  const access: Access = r
    ? { roleId: r.id, roleName: r.name, scope: r.data_scope, permissions: r.permissions ?? {}, isOwner }
    : legacyAccess(String(base.role));
  if (isOwner) { access.isOwner = true; access.scope = "all"; }

  const profile = {
    id: base.id as string, full_name: base.full_name as string, email: base.email as string, role: base.role as "owner" | "rep",
    job_title: (base.job_title as string | null) ?? null, phone: (base.phone as string | null) ?? null,
    ...access,
  } satisfies Profile;
  return { supabase, profile: profile as Profile };
}
