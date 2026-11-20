import "server-only";
import { createClient } from "@supabase/supabase-js";

// Admin access to Supabase (create or remove logins). It uses the secret key, so it only ever runs
// on the server, and only AFTER the code calling it has checked that the person is an Owner.
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
