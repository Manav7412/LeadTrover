import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export type ContactFilters = { q: string; status: string; tag: string; owner: string; staleOnly: boolean };

// The search and filters shared by the Contacts list and its CSV export, so both always agree.
// (Row-level security already hides other reps' contacts from a Rep.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyContactFilters<Q extends PostgrestFilterBuilder<any, any, any, any, any, any, any>>(query: Q, f: ContactFilters, isOwner: boolean): Q {
  let out = query;
  if (f.q) {
    const safe = f.q.replace(/[,()%*\\]/g, " ");
    out = out.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`) as Q;
  }
  if (f.status) out = out.eq("status", f.status) as Q;
  if (f.staleOnly) out = out.eq("is_stale", true) as Q;
  if (f.tag) out = out.contains("tags", [f.tag]) as Q;
  if (f.owner && isOwner) out = out.eq("owner_id", f.owner) as Q;
  return out;
}
