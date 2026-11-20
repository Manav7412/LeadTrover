// Custom objects (Settings > Objects): field types, helpers and the list of built-in objects.

export const FIELD_TYPES = [
  { key: "text", label: "Text" },
  { key: "number", label: "Number" },
  { key: "date", label: "Date" },
  { key: "dropdown", label: "Dropdown" },
  { key: "yesno", label: "Yes / No" },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]["key"];

export type CustomObject = { id: string; name: string; plural: string; slug: string; description: string | null };
export type CustomField = { id: string; object_id: string; label: string; key: string; type: FieldType; options: string[]; required: boolean; position: number };
export type CustomRecord = { id: string; object_id: string; owner_id: string | null; data: Record<string, unknown>; created_at: string };

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// Pretty text for one stored value.
export function showValue(f: CustomField, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (f.type === "yesno") return v === true ? "Yes" : "No";
  return String(v);
}

// The built-in objects, listed read-only in Settings > Objects.
export const STANDARD_OBJECTS = [
  { name: "Contacts", table: "contacts", href: "/contacts", description: "People you sell to. Every contact has an owner.", fields: ["First name", "Last name", "Email", "Phone", "Company", "Owner", "Source", "Status", "Tags"] },
  { name: "Companies", table: "companies", href: "/contacts", description: "Businesses that contacts belong to.", fields: ["Name", "Website", "Industry", "Size", "Owner"] },
  { name: "Deals", table: "deals", href: "/pipelines", description: "Money you could win, moving through a pipeline.", fields: ["Title", "Value", "Contact", "Company", "Pipeline", "Stage", "Owner", "Status"] },
  { name: "Activities", table: "activities", href: "/contacts", description: "Calls, emails, notes and meetings on the timeline.", fields: ["Type", "Contact", "Outcome", "Notes", "Next step", "Logged by"] },
  { name: "Tasks", table: "tasks", href: "/tasks", description: "Follow-ups with a due date.", fields: ["Title", "Contact", "Assigned to", "Due", "Done"] },
  { name: "Pipelines", table: "pipelines", href: "/pipelines", description: "Stages a deal moves through.", fields: ["Name", "Stages (open / won / lost)"] },
  { name: "Email templates", table: "email_templates", href: "/templates", description: "Reusable emails with merge fields.", fields: ["Name", "Subject", "Body"] },
  { name: "Lead forms", table: "lead_forms", href: "/forms", description: "Public forms that create contacts.", fields: ["Name", "Address", "Heading", "Assign to", "Tags", "Source", "Live / paused"] },
] as const;
