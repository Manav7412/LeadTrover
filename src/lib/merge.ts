import { TZ } from "@/lib/dates";

// Merge fields: placeholders like {{first_name}} in a template are replaced with the contact's details.
export const MERGE_FIELDS = [
  { key: "first_name", label: "First name", sample: "Sarah" },
  { key: "last_name", label: "Last name", sample: "Mitchell" },
  { key: "full_name", label: "Full name", sample: "Sarah Mitchell" },
  { key: "company", label: "Company", sample: "Bright Smile Dental" },
  { key: "email", label: "Email", sample: "sarah.mitchell@brightsmile.example" },
  { key: "phone", label: "Phone", sample: "+1 555 0100" },
  { key: "owner_name", label: "Owner name", sample: "Manav" },
  { key: "sender_name", label: "Your name", sample: "Manav" },
  { key: "today", label: "Today's date", sample: "Friday 21 November" },
] as const;

export type MergeValues = Record<string, string>;

const PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;
const KNOWN = new Set<string>(MERGE_FIELDS.map((f) => f.key));

export const sampleValues = (): MergeValues => Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample]));

// Fills in every {{field}} that has a value. Unknown fields are left as typed so mistakes are easy to spot.
export function renderTemplate(text: string, values: MergeValues): string {
  return text.replace(PATTERN, (whole, key: string) => (KNOWN.has(key.toLowerCase()) ? values[key.toLowerCase()] ?? "" : whole));
}

// Fields written as {{something}} that LeadTrove does not know about (typos).
export function unknownFields(text: string): string[] {
  return [...new Set([...text.matchAll(PATTERN)].map((m) => m[1]).filter((k) => !KNOWN.has(k.toLowerCase())))];
}

// Known fields used in the text that have no value for this contact (e.g. a contact with no company).
export function emptyFields(text: string, values: MergeValues): string[] {
  return [...new Set([...text.matchAll(PATTERN)].map((m) => m[1].toLowerCase()).filter((k) => KNOWN.has(k) && !values[k]))];
}

export function mergeValuesFor(
  contact: { first_name: string; last_name: string; email: string | null; phone: string | null; companyName?: string | null; ownerName?: string | null },
  senderName: string,
  now = new Date()
): MergeValues {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name,
    full_name: `${contact.first_name} ${contact.last_name}`.trim(),
    company: contact.companyName ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    owner_name: contact.ownerName ?? "",
    sender_name: senderName,
    today: new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now),
  };
}
