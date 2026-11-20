// Small helpers shared by the contacts pages.

export const STATUSES = ["new", "contacted", "qualified", "customer", "lost"] as const;

export const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-50 text-sky-700",
  contacted: "bg-amber-50 text-amber-700",
  qualified: "bg-violet-50 text-violet-700",
  customer: "bg-emerald-50 text-emerald-700",
  lost: "bg-slate-100 text-slate-600",
};

export const SOURCES = ["Website Form", "Referral", "Facebook Ads", "Google Ads", "Instagram", "LinkedIn", "Cold Outreach", "Event", "CSV import", "Manual"];

export type FormState = { error?: string } | undefined;
// Like FormState, but can also carry a success message (used on the Settings pages).
export type MessageState = { error?: string; message?: string } | undefined;

export function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
