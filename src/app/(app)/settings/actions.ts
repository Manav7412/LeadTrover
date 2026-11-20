"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { ALL_PERMISSION_KEYS, DENIED, can } from "@/lib/permissions";
import type { MessageState } from "@/lib/contacts";

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// ---------- Your profile ----------

export async function updateProfile(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { profile } = await requireProfile();
  const name = clean(formData.get("full_name"));
  const jobTitle = clean(formData.get("job_title"));
  const phone = clean(formData.get("phone"));
  if (!name) return { error: "Please enter your name." };
  if (name.length > 80 || (jobTitle?.length ?? 0) > 80 || (phone?.length ?? 0) > 40) return { error: "One of those answers is too long." };
  // Admin access, but only ever for the signed-in person's own row and only these three fields,
  // so nobody can change their own role this way.
  const { error } = await adminClient().from("profiles").update({ full_name: name, job_title: jobTitle, phone }).eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Profile updated." };
}

export async function changePassword(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { supabase } = await requireProfile();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { message: "Password changed." };
}

// ---------- Team ----------

async function requireTeamManager() {
  const ctx = await requireProfile();
  if (!can(ctx.profile, "team.manage")) throw new Error(DENIED);
  return ctx;
}

async function ownerCount(admin: ReturnType<typeof adminClient>) {
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner");
  return count ?? 0;
}

export async function addTeamMember(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { profile } = await requireTeamManager();
  const name = clean(formData.get("full_name"));
  const email = clean(formData.get("email"))?.toLowerCase();
  const roleId = clean(formData.get("role_id"));
  const password = String(formData.get("password") ?? "");
  if (!name) return { error: "Please enter their name." };
  if (!email || !looksLikeEmail(email)) return { error: "Please enter a valid email address." };
  if (!roleId) return { error: "Choose a role." };
  if (password.length < 8) return { error: "Give them a starting password of at least 8 characters." };

  const admin = adminClient();
  const { data: role } = await admin.from("roles").select("id, name").eq("id", roleId).maybeSingle();
  if (!role) return { error: "That role no longer exists." };
  if (role.name === "Owner" && !profile.isOwner) return { error: "Only an Owner can create another Owner." };

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "Someone with that email already has a login." : error.message };

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id, full_name: name, email, role: role.name === "Owner" ? "owner" : "rep", role_id: role.id,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id); // don't leave a login without a profile
    return { error: profileError.message };
  }
  revalidatePath("/settings/team");
  return { message: `${name} can now sign in with ${email} as ${role.name}. Share the starting password with them.` };
}

export async function changeMemberRole(userId: string, _prev: MessageState, formData: FormData): Promise<MessageState> {
  const { profile } = await requireTeamManager();
  const roleId = clean(formData.get("role_id"));
  if (!roleId) return { error: "Choose a role." };
  const admin = adminClient();
  const [{ data: role }, { data: target }] = await Promise.all([
    admin.from("roles").select("id, name").eq("id", roleId).maybeSingle(),
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);
  if (!role) return { error: "That role no longer exists." };
  if (!target) return { error: "That person no longer exists." };
  if ((role.name === "Owner" || target.role === "owner") && !profile.isOwner) return { error: "Only an Owner can change an Owner's role or make someone an Owner." };
  if (target.role === "owner" && role.name !== "Owner" && (await ownerCount(admin)) <= 1) return { error: "There must always be at least one Owner." };

  const { error } = await admin.from("profiles").update({ role_id: role.id, role: role.name === "Owner" ? "owner" : "rep" }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  revalidatePath("/", "layout");
  return { message: `Role changed to ${role.name}.` };
}

// Removes a person. Their contacts, deals and tasks are handed to you so nothing is orphaned.
export async function removeMember(userId: string): Promise<MessageState> {
  const { profile } = await requireTeamManager();
  if (userId === profile.id) return { error: "You can't remove yourself." };
  const admin = adminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "That person no longer exists." };
  if (target.role === "owner" && !profile.isOwner) return { error: "Only an Owner can remove an Owner." };
  if (target.role === "owner" && (await ownerCount(admin)) <= 1) return { error: "There must always be at least one Owner." };

  for (const [table, column] of [["contacts", "owner_id"], ["deals", "owner_id"], ["companies", "owner_id"], ["tasks", "assigned_to"]] as const) {
    const { error } = await admin.from(table).update({ [column]: profile.id }).eq(column, userId);
    if (error) return { error: `Couldn't hand over their ${table}: ${error.message}` };
  }
  await admin.from("lead_forms").update({ default_owner_id: null }).eq("default_owner_id", userId); // back to auto-assign
  const { error } = await admin.auth.admin.deleteUser(userId); // also removes their profile and sharing rules
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { message: "Removed. Their contacts, deals and tasks were handed over to you." };
}

// ---------- Roles and permissions ----------

const roleError = (e: { code?: string; message: string }) =>
  e.code === "23505" ? "A role with that name already exists."
  : e.code === "23503" ? "People are still using this role. Give them a different role first."
  : e.message;

function parsePermissions(raw: unknown): Record<string, boolean> {
  let obj: Record<string, unknown> = {};
  try { obj = JSON.parse(String(raw ?? "{}")); } catch { /* use empty */ }
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, obj[k] === true]));
}

export async function createRole(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "roles.manage")) return { error: DENIED };
  const name = clean(formData.get("name"));
  if (!name) return { error: "Give the role a name." };
  if (name.length > 40) return { error: "That name is too long (40 characters max)." };
  const copyFrom = clean(formData.get("copy_from"));
  const { data: source } = copyFrom ? await supabase.from("roles").select("data_scope, permissions").eq("id", copyFrom).maybeSingle() : { data: null };
  const permissions = source ? parsePermissions(JSON.stringify(source.permissions)) : parsePermissions("{}");
  permissions["roles.manage"] = false; // new roles never start with the power to edit roles or manage the team
  permissions["team.manage"] = false;
  const { error } = await supabase.from("roles")
    .insert({ name, description: clean(formData.get("description")), data_scope: source?.data_scope ?? "own", permissions });
  if (error) return { error: roleError(error) };
  revalidatePath("/settings/roles");
  return { message: `Role "${name}" created. Pick it from the list to set its permissions.` };
}

export async function saveRole(roleId: string, _prev: MessageState, formData: FormData): Promise<MessageState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "roles.manage")) return { error: DENIED };
  const { data: role } = await supabase.from("roles").select("name, is_system").eq("id", roleId).maybeSingle();
  if (!role) return { error: "That role no longer exists." };
  if (role.name === "Owner") return { error: "The Owner role is locked." };

  const changes: Record<string, unknown> = {
    data_scope: String(formData.get("data_scope")) === "all" ? "all" : "own",
    permissions: parsePermissions(formData.get("permissions")),
  };
  if (!role.is_system) {
    const name = clean(formData.get("name"));
    if (!name) return { error: "Give the role a name." };
    if (name.length > 40) return { error: "That name is too long (40 characters max)." };
    changes.name = name;
    changes.description = clean(formData.get("description"));
  }
  const { error } = await supabase.from("roles").update(changes).eq("id", roleId);
  if (error) return { error: roleError(error) };
  revalidatePath("/settings", "layout");
  revalidatePath("/", "layout");
  return { message: "Role saved. The change applies straight away." };
}

export async function deleteRole(roleId: string): Promise<MessageState> {
  const { supabase, profile } = await requireProfile();
  if (!can(profile, "roles.manage")) return { error: DENIED };
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role_id", roleId);
  if (count) return { error: `${count} ${count === 1 ? "person is" : "people are"} still using this role. Give them a different role first.` };
  const { data, error } = await supabase.from("roles").delete().eq("id", roleId).select("id");
  if (error) return { error: roleError(error) };
  if (!data?.length) return { error: "Built-in roles can't be deleted." };
  revalidatePath("/settings/roles");
  return { message: "Role deleted." };
}

// ---------- Sharing rules ----------

export async function addSharingRule(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { supabase, profile } = await requireProfile();
  const from = can(profile, "roles.manage") ? clean(formData.get("from_user")) ?? profile.id : profile.id; // everyone else can only share their own records
  const to = clean(formData.get("to_user"));
  const access = String(formData.get("access")) === "edit" ? "edit" : "view";
  if (!to) return { error: "Choose who to share with." };
  if (to === from) return { error: "That's the same person." };
  const { error } = await supabase.from("sharing_rules").upsert({ from_user: from, to_user: to, access }, { onConflict: "from_user,to_user" });
  if (error) return { error: error.message };
  revalidatePath("/settings/sharing");
  return { message: "Sharing rule saved." };
}

export async function deleteSharingRule(ruleId: string) {
  const { supabase } = await requireProfile();
  await supabase.from("sharing_rules").delete().eq("id", ruleId);
  revalidatePath("/settings/sharing");
}
