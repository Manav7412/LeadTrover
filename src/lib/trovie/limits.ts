// A daily message allowance per person. Uses the database counter from supabase/trovie.sql,
// and falls back to a per-server counter if that SQL hasn't been run yet.
import type { SupabaseClient } from "@supabase/supabase-js";

export const GUEST_EMAIL = "guest@leadtrove.demo";
// The Guest login is ONE shared account, so its allowance is shared by every visitor of the public demo.
export const DAILY_LIMIT_GUEST = Number(process.env.TROVIE_GUEST_DAILY_LIMIT) || 25;
export const DAILY_LIMIT_USER = Number(process.env.TROVIE_USER_DAILY_LIMIT) || 60;
export const MAX_QUESTION_CHARS = 1500;

const memory = new Map<string, number>();

export async function takeAllowance(supabase: SupabaseClient, userId: string, isGuest: boolean): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = isGuest ? DAILY_LIMIT_GUEST : DAILY_LIMIT_USER;
  const { data, error } = await supabase.rpc("trovie_hit");
  let used: number;
  if (error || typeof data !== "number") {
    const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
    used = (memory.get(key) ?? 0) + 1;
    memory.set(key, used);
  } else used = data;
  return { ok: used <= limit, used, limit };
}
