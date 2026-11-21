// What Trovie can look up. Every tool runs as the signed-in person (row-level security), so Trovie can only
// ever see what that person can see. All tools are READ-ONLY: Trovie cannot change anything yet.
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { applyContactFilters } from "@/lib/contact-filters";
import { dateInputFrom, formatDue, startOfToday } from "@/lib/dates";

type Ctx = { supabase: SupabaseClient; userId: string; scopeAll: boolean };

const DAY = 86_400_000;
const clamp = (v: unknown, min: number, max: number, dflt: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : dflt; };
const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const daysSince = (iso: string | null, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null);
const nameOf = (c: { first_name: string; last_name: string } | null | undefined) => (c ? `${c.first_name} ${c.last_name}`.trim() : null);

export const TROVIE_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_overview",
    description: "Headline numbers for the CRM: open leads, stale leads, leads with no next step, tasks due today, overdue tasks, open pipeline value, and deals won in the last 30 days. Use it for general 'how am I doing' questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: "list_tasks",
    description: "List follow-up tasks. filter: 'today' (due today), 'overdue' (past due, not done), 'upcoming' (after today). Returns the task, its contact and when it is due.",
    input_schema: {
      type: "object",
      properties: { filter: { type: "string", enum: ["today", "overdue", "upcoming"] }, limit: { type: "integer", description: "1 to 25, default 10" } },
      required: ["filter"], additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "list_stale_leads",
    description: "Leads that have had no activity for 7+ days (flagged stale), quietest first.",
    input_schema: { type: "object", properties: { limit: { type: "integer", description: "1 to 25, default 10" } }, additionalProperties: false },
    strict: true,
  },
  {
    name: "search_contacts",
    description: "Find contacts by name, email or phone, and/or filter by status (new, contacted, qualified, customer, lost) or tag. Returns a short list; use get_contact for full details.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of a name, email or phone number" },
        status: { type: "string", enum: ["new", "contacted", "qualified", "customer", "lost"] },
        tag: { type: "string" },
        limit: { type: "integer", description: "1 to 25, default 10" },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "get_contact",
    description: "Everything about one contact: details, owner, custom fields, recent activity, open tasks, deals and attached file names. Pass contact_id (from another tool) or a name to search for.",
    input_schema: {
      type: "object",
      properties: { contact_id: { type: "string" }, name: { type: "string", description: "Full or partial name or email" } },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "list_deals",
    description: "List deals with their stage, value and owner. status: 'open', 'won', 'lost' or 'any' (default 'open'). Optionally restrict to one pipeline by name.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "won", "lost", "any"] },
        pipeline: { type: "string", description: "Pipeline name, e.g. Sales" },
        limit: { type: "integer", description: "1 to 25, default 10" },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "pipeline_summary",
    description: "For each pipeline: the number and total value of open deals in every stage, plus deals won and lost in the last 30 days.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
];

// Short, friendly text shown to the person while a tool runs.
export const TOOL_STATUS: Record<string, string> = {
  get_overview: "Checking your numbers…",
  list_tasks: "Looking at your tasks…",
  list_stale_leads: "Finding stale leads…",
  search_contacts: "Searching contacts…",
  get_contact: "Opening that contact…",
  list_deals: "Looking at your deals…",
  pipeline_summary: "Summing up your pipeline…",
};

export async function runTool(name: string, input: Record<string, unknown>, ctx: Ctx): Promise<{ text: string; isError?: boolean }> {
  try {
    const out = await dispatch(name, input ?? {}, ctx);
    const text = JSON.stringify(out);
    return { text: text.length > 12_000 ? text.slice(0, 12_000) + '…"(shortened)"' : text };
  } catch (e) {
    return { text: `That lookup failed: ${e instanceof Error ? e.message : "unknown error"}`, isError: true };
  }
}

async function dispatch(name: string, input: Record<string, unknown>, { supabase, scopeAll }: Ctx): Promise<unknown> {
  const nowDate = new Date();
  const now = nowDate.getTime();
  const dayStart = startOfToday(nowDate).getTime();

  switch (name) {
    case "get_overview": {
      const [{ data: leads }, { data: tasks }, { data: deals }] = await Promise.all([
        supabase.from("contacts").select("id, is_stale").not("status", "in", "(customer,lost)"),
        supabase.from("tasks").select("contact_id, due_at").eq("done", false),
        supabase.from("deals").select("value, status, closed_at"),
      ]);
      const withTask = new Set((tasks ?? []).map((t) => t.contact_id).filter(Boolean));
      const due = (t: { due_at: string }) => new Date(t.due_at).getTime();
      const monthAgo = now - 30 * DAY;
      return {
        openLeads: (leads ?? []).length,
        staleLeads: (leads ?? []).filter((l) => l.is_stale).length,
        openLeadsWithNoNextStep: (leads ?? []).filter((l) => !withTask.has(l.id)).length,
        tasksDueToday: (tasks ?? []).filter((t) => due(t) >= dayStart && due(t) < dayStart + DAY).length,
        overdueTasks: (tasks ?? []).filter((t) => due(t) < dayStart).length,
        openPipelineValueAUD: (deals ?? []).filter((d) => d.status === "open").reduce((s, d) => s + Number(d.value), 0),
        openDeals: (deals ?? []).filter((d) => d.status === "open").length,
        wonLast30DaysAUD: (deals ?? []).filter((d) => d.status === "won" && d.closed_at && new Date(d.closed_at).getTime() >= monthAgo).reduce((s, d) => s + Number(d.value), 0),
        viewingScope: scopeAll ? "everyone's records" : "only the signed-in person's own records",
      };
    }

    case "list_tasks": {
      const filter = str(input.filter, 10);
      const limit = clamp(input.limit, 1, 25, 10);
      let q = supabase.from("tasks").select("id, title, due_at, contacts(id, first_name, last_name), profiles:assigned_to(full_name)").eq("done", false).order("due_at", { ascending: true }).limit(limit);
      if (filter === "today") q = q.gte("due_at", new Date(dayStart).toISOString()).lt("due_at", new Date(dayStart + DAY).toISOString());
      else if (filter === "overdue") q = q.lt("due_at", new Date(dayStart).toISOString());
      else if (filter === "upcoming") q = q.gte("due_at", new Date(dayStart + DAY).toISOString());
      else return { error: "filter must be today, overdue or upcoming" };
      const { data, error } = await q.overrideTypes<{ id: string; title: string; due_at: string; contacts: { id: string; first_name: string; last_name: string } | null; profiles: { full_name: string } | null }[], { merge: false }>();
      if (error) throw new Error(error.message);
      return { filter, count: (data ?? []).length, tasks: (data ?? []).map((t) => ({ title: t.title, due: formatDue(t.due_at, nowDate), contactId: t.contacts?.id ?? null, contact: nameOf(t.contacts), assignedTo: t.profiles?.full_name ?? null })) };
    }

    case "list_stale_leads": {
      const limit = clamp(input.limit, 1, 25, 10);
      const { data, error } = await supabase.from("contacts").select("id, first_name, last_name, status, last_activity_at, companies(name), profiles:owner_id(full_name)")
        .eq("is_stale", true).order("last_activity_at", { ascending: true, nullsFirst: true }).limit(limit)
        .overrideTypes<{ id: string; first_name: string; last_name: string; status: string; last_activity_at: string | null; companies: { name: string } | null; profiles: { full_name: string } | null }[], { merge: false }>();
      if (error) throw new Error(error.message);
      return { count: (data ?? []).length, leads: (data ?? []).map((c) => ({ id: c.id, name: nameOf(c), company: c.companies?.name ?? null, status: c.status, owner: c.profiles?.full_name ?? "Unassigned", daysQuiet: daysSince(c.last_activity_at, now) ?? "never contacted" })) };
    }

    case "search_contacts": {
      const limit = clamp(input.limit, 1, 25, 10);
      let q = supabase.from("contacts").select("id, first_name, last_name, email, phone, status, tags, is_stale, last_activity_at, companies(name), profiles:owner_id(full_name)").order("created_at", { ascending: false }).limit(limit);
      q = applyContactFilters(q, { q: str(input.query), status: str(input.status, 20), tag: str(input.tag, 40), owner: "", staleOnly: false }, scopeAll);
      const { data, error } = await q.overrideTypes<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null; status: string; tags: string[]; is_stale: boolean; last_activity_at: string | null; companies: { name: string } | null; profiles: { full_name: string } | null }[], { merge: false }>();
      if (error) throw new Error(error.message);
      return { count: (data ?? []).length, contacts: (data ?? []).map((c) => ({ id: c.id, name: nameOf(c), company: c.companies?.name ?? null, email: c.email, phone: c.phone, status: c.status, tags: c.tags, stale: c.is_stale, owner: c.profiles?.full_name ?? "Unassigned", daysSinceActivity: daysSince(c.last_activity_at, now) })) };
    }

    case "get_contact": {
      let id = str(input.contact_id, 60);
      if (!id) {
        const name = str(input.name);
        if (!name) return { error: "Give a contact_id or a name." };
        let q = supabase.from("contacts").select("id, first_name, last_name, companies(name)").limit(5);
        const parts = name.split(/\s+/);
        q = applyContactFilters(q, { q: parts.length > 1 ? parts[0] : name, status: "", tag: "", owner: "", staleOnly: false }, scopeAll);
        const { data } = await q.overrideTypes<{ id: string; first_name: string; last_name: string; companies: { name: string } | null }[], { merge: false }>();
        const hits = (data ?? []).filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(name.toLowerCase()) || parts.every((p) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(p.toLowerCase())));
        if (hits.length === 0) return { error: `No contact found matching "${name}".` };
        if (hits.length > 1) return { multipleMatches: hits.map((c) => ({ id: c.id, name: nameOf(c), company: c.companies?.name ?? null })), note: "Ask which one the person means." };
        id = hits[0].id;
      }
      const { data: c } = await supabase.from("contacts").select("*, companies(name, industry), profiles:owner_id(full_name)").eq("id", id).maybeSingle();
      if (!c) return { error: "Contact not found (or you don't have access)." };
      const [{ data: acts }, { data: tasks }, { data: deals }, { data: files }, { data: fields }] = await Promise.all([
        supabase.from("activities").select("type, outcome, notes, next_step, created_at, profiles:user_id(full_name)").eq("contact_id", id).order("created_at", { ascending: false }).limit(8)
          .overrideTypes<{ type: string; outcome: string | null; notes: string | null; next_step: string | null; created_at: string; profiles: { full_name: string } | null }[], { merge: false }>(),
        supabase.from("tasks").select("title, due_at").eq("contact_id", id).eq("done", false).order("due_at"),
        supabase.from("deals").select("title, value, status, stages(name)").eq("contact_id", id)
          .overrideTypes<{ title: string; value: number; status: string; stages: { name: string } | null }[], { merge: false }>(),
        supabase.from("contact_files").select("name").eq("contact_id", id).limit(20),
        supabase.from("custom_fields").select("label, key").eq("standard_object", "contacts"),
      ]);
      const custom = Object.fromEntries((fields ?? []).map((f) => [f.label, (c.custom ?? {})[f.key]]).filter(([, v]) => v !== undefined && v !== ""));
      return {
        id: c.id, name: nameOf(c), email: c.email, phone: c.phone, company: c.companies?.name ?? null, industry: c.companies?.industry ?? null,
        status: c.status, source: c.source, tags: c.tags, owner: c.profiles?.full_name ?? "Unassigned", stale: c.is_stale,
        daysSinceLastActivity: daysSince(c.last_activity_at, now), customFields: custom,
        recentActivity: (acts ?? []).map((a) => ({ type: a.type, outcome: a.outcome, notes: a.notes?.slice(0, 300) ?? null, nextStep: a.next_step, when: dateInputFrom(a.created_at), by: a.profiles?.full_name ?? null })),
        openTasks: (tasks ?? []).map((t) => ({ title: t.title, due: formatDue(t.due_at, nowDate) })),
        deals: (deals ?? []).map((d) => ({ title: d.title, valueAUD: Number(d.value), stage: d.stages?.name ?? null, status: d.status })),
        attachedFiles: (files ?? []).map((f) => f.name),
      };
    }

    case "list_deals": {
      const status = str(input.status, 6) || "open";
      const limit = clamp(input.limit, 1, 25, 10);
      let q = supabase.from("deals").select("title, value, status, stages(name), pipelines(name), contacts(id, first_name, last_name), profiles:owner_id(full_name)").order("value", { ascending: false }).limit(limit);
      if (["open", "won", "lost"].includes(status)) q = q.eq("status", status);
      const { data, error } = await q.overrideTypes<{ title: string; value: number; status: string; stages: { name: string } | null; pipelines: { name: string } | null; contacts: { id: string; first_name: string; last_name: string } | null; profiles: { full_name: string } | null }[], { merge: false }>();
      if (error) throw new Error(error.message);
      const wanted = str(input.pipeline, 60).toLowerCase();
      const rows = (data ?? []).filter((d) => !wanted || (d.pipelines?.name ?? "").toLowerCase() === wanted);
      return { count: rows.length, deals: rows.map((d) => ({ title: d.title, valueAUD: Number(d.value), stage: d.stages?.name ?? null, pipeline: d.pipelines?.name ?? null, status: d.status, contactId: d.contacts?.id ?? null, contact: nameOf(d.contacts), owner: d.profiles?.full_name ?? "Unassigned" })) };
    }

    case "pipeline_summary": {
      const [{ data: pipelines }, { data: stages }, { data: deals }] = await Promise.all([
        supabase.from("pipelines").select("id, name").order("position"),
        supabase.from("stages").select("id, name, pipeline_id, outcome").order("position"),
        supabase.from("deals").select("value, status, stage_id, pipeline_id, closed_at"),
      ]);
      const monthAgo = now - 30 * DAY;
      return (pipelines ?? []).map((p) => {
        const mine = (deals ?? []).filter((d) => d.pipeline_id === p.id);
        return {
          pipeline: p.name,
          openStages: (stages ?? []).filter((s) => s.pipeline_id === p.id && s.outcome === "open").map((s) => {
            const ds = mine.filter((d) => d.stage_id === s.id && d.status === "open");
            return { stage: s.name, deals: ds.length, valueAUD: ds.reduce((sum, d) => sum + Number(d.value), 0) };
          }),
          wonLast30Days: { deals: mine.filter((d) => d.status === "won" && d.closed_at && new Date(d.closed_at).getTime() >= monthAgo).length, valueAUD: mine.filter((d) => d.status === "won" && d.closed_at && new Date(d.closed_at).getTime() >= monthAgo).reduce((s, d) => s + Number(d.value), 0) },
          lostLast30Days: mine.filter((d) => d.status === "lost" && d.closed_at && new Date(d.closed_at).getTime() >= monthAgo).length,
        };
      });
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
