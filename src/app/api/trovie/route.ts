import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { seesAll } from "@/lib/permissions";
import { TROVIE_SYSTEM, whoIsAsking } from "@/lib/trovie/prompt";
import { TOOL_STATUS, TROVIE_TOOLS, runTool } from "@/lib/trovie/tools";
import { GUEST_EMAIL, MAX_QUESTION_CHARS, takeAllowance } from "@/lib/trovie/limits";

// Trovie's brain. The browser sends the conversation; we stream the answer back as it is written.
// The AI key stays on the server, every lookup runs as the signed-in person, and each person has a daily allowance.
export const maxDuration = 60;

const MODEL = process.env.TROVIE_MODEL || "claude-opus-5-5";
const MAX_TURNS = 6;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type Msg = { role: "user" | "assistant"; content: string };
const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

function cleanConversation(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const out: Msg[] = [];
  let total = 0;
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, m.role === "user" ? MAX_QUESTION_CHARS : 6000);
    if (!content) return null;
    total += content.length;
    out.push({ role: m.role, content });
  }
  if (total > 24_000 || out[out.length - 1].role !== "user") return null;
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Please sign in first." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const messages = cleanConversation((body as { messages?: unknown })?.messages);
  if (!messages) return Response.json({ error: "Please send a short question." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          send({ t: "error", code: "not_configured", message: "I'm not connected to my brain yet. Ask your admin to add the Anthropic API key." });
          return;
        }
        const { supabase: db, profile } = await requireProfile();
        const allowance = await takeAllowance(db, profile.id, profile.email === GUEST_EMAIL);
        if (!allowance.ok) {
          send({ t: "error", code: "limit", message: `You've used today's ${allowance.limit} questions. I'll be back tomorrow!` });
          return;
        }

        const client = new Anthropic({ maxRetries: 2 });
        const today = new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
        const system = [
          { type: "text" as const, text: TROVIE_SYSTEM },
          { type: "text" as const, text: whoIsAsking({ name: profile.full_name, role: profile.roleName, seesEveryone: seesAll(profile), todayLabel: today }) },
        ];
        const convo: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
        let useFallback = true;
        let sentText = false;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          let final: Anthropic.Beta.BetaMessage;
          try {
            const run = client.beta.messages.stream({
              model: MODEL, max_tokens: 8000, system, tools: TROVIE_TOOLS, messages: convo,
              output_config: { effort: "low" },
              ...(useFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
            });
            if (sentText) send({ t: "text", delta: "\n\n" });
            run.on("text", (delta) => { sentText = true; send({ t: "text", delta }); });
            final = await run.finalMessage();
          } catch (e) {
            // if the optional safety-fallback setting is rejected, run again without it
            if (useFallback && e instanceof Anthropic.BadRequestError && /fallback|beta/i.test(e.message)) { useFallback = false; turn--; continue; }
            throw e;
          }

          if (final.stop_reason === "refusal") { send({ t: "text", delta: sentText ? "" : "I can't help with that one, sorry. Try asking about your leads, tasks or deals." }); break; }
          if (final.stop_reason === "max_tokens") { send({ t: "text", delta: "\n\n(That answer got cut short. Ask me to continue.)" }); break; }
          if (final.stop_reason !== "tool_use") break;

          convo.push({ role: "assistant", content: final.content as Anthropic.Beta.BetaContentBlockParam[] });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type !== "tool_use") continue;
            send({ t: "status", text: TOOL_STATUS[block.name] ?? "Looking that up…" });
            const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, { supabase: db, userId: profile.id, scopeAll: seesAll(profile) });
            results.push({ type: "tool_result", tool_use_id: block.id, content: out.text, ...(out.isError ? { is_error: true } : {}) });
          }
          convo.push({ role: "user", content: results });
        }
        send({ t: "done", remaining: Math.max(0, allowance.limit - allowance.used) });
      } catch (e) {
        const message =
          e instanceof Anthropic.AuthenticationError ? "My API key isn't valid. Ask your admin to check it."
          : e instanceof Anthropic.RateLimitError ? "I'm a bit busy right now. Please try again in a minute."
          : e instanceof Anthropic.APIError ? "I couldn't reach my brain just now. Please try again."
          : "Something went wrong on my side. Please try again.";
        console.error("[trovie]", e instanceof Error ? e.message : e);
        send({ t: "error", code: "failed", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
