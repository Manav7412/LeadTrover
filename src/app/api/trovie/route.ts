import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { seesAll } from "@/lib/permissions";
import { TROVIE_SYSTEM, whoIsAsking } from "@/lib/trovie/prompt";
import { TOOL_STATUS, TROVIE_TOOLS, runTool } from "@/lib/trovie/tools";
import { GUEST_EMAIL, MAX_QUESTION_CHARS, takeAllowance } from "@/lib/trovie/limits";

// Trovie's brain. The browser sends the conversation; we stream the answer back as it is written.
// The AI key stays on the server, every lookup runs as the signed-in person, and each person has a daily allowance.
export const maxDuration = 60;

// Gemini's free tier. Change the model with TROVIE_MODEL (e.g. gemini-3.5-flash is smarter but slower and often busy on the free plan).
const MODEL = process.env.TROVIE_MODEL || "gemini-3.5-flash-lite";
const MAX_TURNS = 6;
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

type Part = { text?: string; thought?: boolean; functionCall?: { id?: string; name: string; args?: Record<string, unknown> }; functionResponse?: unknown; [k: string]: unknown };
type Content = { role: "user" | "model"; parts: Part[] };

// Gemini wants a simpler schema than Claude: no "additionalProperties", and no empty "properties".
function cleanSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(cleanSchema);
  if (s && typeof s === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (k !== "additionalProperties") o[k] = cleanSchema(v);
    return o;
  }
  return s;
}
const FUNCTIONS = TROVIE_TOOLS.map((t) => {
  const schema = cleanSchema(t.input_schema) as { properties?: Record<string, unknown> };
  const hasProps = schema.properties && Object.keys(schema.properties).length > 0;
  return { name: t.name, description: t.description, ...(hasProps ? { parameters: schema } : {}) };
});

class GeminiError extends Error { constructor(public status: number, message: string) { super(message); } }

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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          send({ t: "error", code: "not_configured", message: "I'm not connected to my brain yet. Ask your admin to add the Gemini API key." });
          return;
        }
        const { supabase: db, profile } = await requireProfile();
        const allowance = await takeAllowance(db, profile.id, profile.email === GUEST_EMAIL);
        if (!allowance.ok) {
          send({ t: "error", code: "limit", message: `You've used today's ${allowance.limit} questions. I'll be back tomorrow!` });
          return;
        }

        const today = new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
        const system = TROVIE_SYSTEM + "\n\n" + whoIsAsking({ name: profile.full_name, role: profile.roleName, seesEveryone: seesAll(profile), todayLabel: today });
        const convo: Content[] = messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
        let sentText = false;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const callGemini = () => fetch(`${GEMINI}/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: convo,
              tools: [{ functionDeclarations: FUNCTIONS }],
              generationConfig: { maxOutputTokens: 8000, temperature: 0.4 },
            }),
          });
          let res = await callGemini();
          // Google's free servers are sometimes busy: wait a moment and try once more
          if (res.status === 503 || res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); res = await callGemini(); }
          if (!res.ok || !res.body) throw new GeminiError(res.status, (await res.text().catch(() => "")).slice(0, 400));

          // read the streamed answer: text goes straight to the browser, function calls are collected
          const parts: Part[] = [];
          let finish = "";
          let blocked = "";
          let started = false;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          const handle = (line: string) => {
            if (!line.startsWith("data:")) return;
            let chunk: { candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
            try { chunk = JSON.parse(line.slice(5).trim()); } catch { return; }
            if (chunk.promptFeedback?.blockReason) blocked = chunk.promptFeedback.blockReason;
            const cand = chunk.candidates?.[0];
            if (!cand) return;
            for (const part of cand.content?.parts ?? []) {
              parts.push(part);
              if (part.text && !part.thought) {
                if (!started && sentText) send({ t: "text", delta: "\n\n" });
                started = true; sentText = true;
                send({ t: "text", delta: part.text });
              }
            }
            if (cand.finishReason) finish = cand.finishReason;
          };
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl).trim()); buf = buf.slice(nl + 1); }
          }
          if (buf.trim()) handle(buf.trim());

          const calls = parts.filter((p) => p.functionCall);
          if (calls.length === 0) {
            if (!sentText) {
              const refused = blocked || finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "RECITATION";
              send({ t: "text", delta: refused ? "I can't help with that one, sorry. Try asking about your leads, tasks or deals." : "I didn't get an answer together. Please try asking again." });
            } else if (finish === "MAX_TOKENS") send({ t: "text", delta: "\n\n(That answer got cut short. Ask me to continue.)" });
            break;
          }

          // run the lookups, then give Gemini the results (its own parts are sent back unchanged)
          convo.push({ role: "model", parts });
          const answers: Part[] = [];
          for (const p of calls) {
            const fc = p.functionCall!;
            send({ t: "status", text: TOOL_STATUS[fc.name] ?? "Looking that up…" });
            const out = await runTool(fc.name, fc.args ?? {}, { supabase: db, userId: profile.id, scopeAll: seesAll(profile) });
            answers.push({ functionResponse: { ...(fc.id ? { id: fc.id } : {}), name: fc.name, response: out.isError ? { error: out.text } : { result: out.text } } });
          }
          convo.push({ role: "user", parts: answers });
        }
        send({ t: "done", remaining: Math.max(0, allowance.limit - allowance.used) });
      } catch (e) {
        const status = e instanceof GeminiError ? e.status : 0;
        const message =
          status === 429 ? "I'm a bit busy right now (free plan limit). Please try again in a minute."
          : status === 401 || status === 403 || (status === 400 && /api key/i.test((e as Error).message)) ? "My API key isn't valid. Ask your admin to check it."
          : status ? "I couldn't reach my brain just now. Please try again."
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
