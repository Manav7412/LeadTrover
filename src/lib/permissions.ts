// Everything about what a role may do. The database enforces these too (supabase/permissions.sql);
// the app uses them to hide buttons and to give friendly messages instead of raw errors.

export type PermissionItem = { key: string; label: string; hint: string };
export type PermissionGroup = { title: string; items: PermissionItem[] };

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Contacts",
    items: [
      { key: "contacts.create", label: "Add contacts", hint: "Create new contacts and companies" },
      { key: "contacts.edit", label: "Edit contacts", hint: "Change contact details, tags and owner" },
      { key: "contacts.delete", label: "Delete contacts", hint: "Permanently remove contacts" },
      { key: "contacts.import", label: "Import contacts", hint: "Upload CSV files" },
      { key: "contacts.export", label: "Export data", hint: "Download contacts, tasks and deals as CSV" },
    ],
  },
  {
    title: "Deals and pipelines",
    items: [
      { key: "deals.create", label: "Add deals", hint: "Create deals on a pipeline" },
      { key: "deals.edit", label: "Edit and move deals", hint: "Change deals and drag them between stages" },
      { key: "deals.delete", label: "Delete deals", hint: "Permanently remove deals" },
      { key: "pipelines.manage", label: "Manage pipelines", hint: "Create, rename and delete pipelines and their stages" },
    ],
  },
  {
    title: "Tasks and activity",
    items: [
      { key: "tasks.manage", label: "Manage tasks", hint: "Add, edit, complete and delete tasks" },
      { key: "activities.log", label: "Log activity and emails", hint: "Log calls, emails, notes and meetings on contacts" },
    ],
  },
  {
    title: "Templates, forms and reports",
    items: [
      { key: "templates.manage", label: "Manage email templates", hint: "Create, edit and delete templates" },
      { key: "forms.manage", label: "Manage lead forms", hint: "Create and edit public lead capture forms" },
      { key: "dashboard.view", label: "View the dashboard", hint: "See the reports and charts" },
    ],
  },
  {
    title: "Administration",
    items: [
      { key: "team.manage", label: "Manage the team", hint: "Add and remove people and change their role" },
      { key: "roles.manage", label: "Manage roles and sharing", hint: "Edit roles, permissions and sharing rules for everyone" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export type DataScope = "own" | "all";

export type Access = {
  roleId: string | null;
  roleName: string;
  scope: DataScope;
  permissions: Record<string, boolean>;
  isOwner: boolean; // the locked Owner role: can do everything
};

export const allOn = (): Record<string, boolean> => Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true]));

// Used only if the roles table does not exist yet (before supabase/permissions.sql has been run).
export function legacyAccess(role: string): Access {
  if (role === "owner") return { roleId: null, roleName: "Owner", scope: "all", permissions: allOn(), isOwner: true };
  return {
    roleId: null, roleName: "Rep", scope: "own", isOwner: false,
    permissions: { ...allOn(), "forms.manage": false, "team.manage": false, "roles.manage": false },
  };
}

export const can = (a: { permissions: Record<string, boolean>; isOwner: boolean }, key: string) => a.isOwner || a.permissions[key] === true;
export const seesAll = (a: { scope: DataScope; isOwner: boolean }) => a.isOwner || a.scope === "all";

export const DENIED = "You don't have permission to do that. Ask an Owner to change your role.";
