import { createClient } from "@/lib/supabase/server";
import { applyContactFilters } from "@/lib/contact-filters";
import { csvResponse, fetchAll, isoDate, toCsv, yesNo } from "@/lib/csv";
import { formatDue, startOfToday } from "@/lib/dates";
import { bucketTasks, TASK_TABS, type TaskTab } from "@/lib/tasks";
import { can, legacyAccess, seesAll } from "@/lib/permissions";

// Downloads a list as a CSV file: /export/contacts, /export/tasks, /export/deals, /export/timeline
// It runs as the signed-in user, so a Rep can only ever export their own records.
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const url = new URL(request.url);
  const param = (k: string) => url.searchParams.get(k)?.trim() ?? "";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Please sign in first.", { status: 401 });
  // what this person is allowed to do (falls back to the basic role until supabase/permissions.sql has been run)
  const { data: me } = await supabase.from("profiles").select("role, roles(data_scope, permissions)").eq("id", auth.user.id).maybeSingle();
  const { data: basic } = me ? { data: me } : await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const roleRow = (me as { roles?: { data_scope: "own" | "all"; permissions: Record<string, boolean> } | null } | null)?.roles;
  const access = roleRow
    ? { isOwner: basic?.role === "owner", scope: roleRow.data_scope, permissions: roleRow.permissions }
    : legacyAccess(String(basic?.role ?? "rep"));
  if (!can(access, "contacts.export")) return new Response("You don't have permission to export data.", { status: 403 });
  const isOwner = seesAll(access);

  try {
    switch (kind) {
      case "contacts": return await contacts();
      case "tasks": return await tasks();
      case "deals": return await deals();
      case "timeline": return await timeline();
      default: return new Response("Unknown export.", { status: 404 });
    }
  } catch (e) {
    return new Response(`Export failed: ${e instanceof Error ? e.message : "unknown error"}`, { status: 500 });
  }

  // ----- Contacts (same search and filters as the Contacts page) -----
  async function contacts() {
    type Row = {
      id: string; first_name: string; last_name: string; email: string | null; phone: string | null; status: string; source: string;
      tags: string[]; is_stale: boolean; last_activity_at: string | null; created_at: string;
      companies: { name: string } | null; profiles: { full_name: string } | null;
    };
    const filters = { q: param("q"), status: param("status"), tag: param("tag"), owner: param("owner"), staleOnly: param("stale") === "1" };
    const rows = await fetchAll<Row>((from, to) =>
      applyContactFilters(
        supabase.from("contacts")
          .select("id, first_name, last_name, email, phone, status, source, tags, is_stale, last_activity_at, created_at, companies(name), profiles:owner_id(full_name)")
          .order("created_at", { ascending: false }).order("id"),
        filters, isOwner
      ).range(from, to).overrideTypes<Row[], { merge: false }>()
    );

    // latest "next step" per contact, fetched in small groups to keep requests short
    const nextSteps = new Map<string, string>();
    for (let i = 0; i < rows.length; i += 100) {
      const { data } = await supabase.from("activities").select("contact_id, next_step").in("contact_id", rows.slice(i, i + 100).map((r) => r.id))
        .not("next_step", "is", null).order("created_at", { ascending: false });
      for (const a of data ?? []) if (!nextSteps.has(a.contact_id)) nextSteps.set(a.contact_id, a.next_step);
    }

    // Column names match what Import CSV understands, so an export can be imported again.
    return csvResponse("contacts", toCsv(
      ["First Name", "Last Name", "Email", "Phone", "Company", "Owner", "Status", "Source", "Tags", "Stale", "Next Step", "Last Activity", "Created"],
      rows.map((r) => [r.first_name, r.last_name, r.email, r.phone, r.companies?.name, r.profiles?.full_name, r.status, r.source,
        r.tags.join(", "), yesNo(r.is_stale), nextSteps.get(r.id), isoDate(r.last_activity_at), isoDate(r.created_at)])
    ));
  }

  // ----- Tasks (the tab and assignee filter you are looking at) -----
  async function tasks() {
    type Row = { id: string; title: string; due_at: string; done: boolean; contacts: { first_name: string; last_name: string } | null; profiles: { full_name: string } | null };
    const who = param("who");
    const all = await fetchAll<Row>((from, to) => {
      let q = supabase.from("tasks").select("id, title, due_at, done, contacts(first_name, last_name), profiles:assigned_to(full_name)")
        .order("due_at", { ascending: true }).order("id");
      if (who && isOwner) q = q.eq("assigned_to", who);
      return q.range(from, to).overrideTypes<Row[], { merge: false }>();
    });
    const tab = (TASK_TABS as readonly string[]).includes(param("tab")) ? (param("tab") as TaskTab) : null;
    const rows = tab ? bucketTasks(all, startOfToday().getTime())[tab] : all;
    return csvResponse(`tasks${tab ? "-" + tab : ""}`, toCsv(
      ["Task", "Contact", "Assigned To", "Due", "Status"],
      rows.map((t) => [t.title, t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}`.trim() : "", t.profiles?.full_name,
        formatDue(t.due_at), t.done ? "Done" : new Date(t.due_at).getTime() < startOfToday().getTime() ? "Overdue" : "Open"])
    ));
  }

  // ----- Deals (one pipeline) -----
  async function deals() {
    type Row = {
      title: string; value: number; status: string; created_at: string; closed_at: string | null;
      stages: { name: string } | null; pipelines: { name: string } | null;
      contacts: { first_name: string; last_name: string } | null; companies: { name: string } | null; profiles: { full_name: string } | null;
    };
    const pipelineId = param("p");
    const rows = await fetchAll<Row>((from, to) => {
      let q = supabase.from("deals")
        .select("title, value, status, created_at, closed_at, stages(name), pipelines(name), contacts(first_name, last_name), companies(name), profiles:owner_id(full_name)")
        .order("created_at", { ascending: false }).order("id");
      if (pipelineId) q = q.eq("pipeline_id", pipelineId);
      return q.range(from, to).overrideTypes<Row[], { merge: false }>();
    });
    return csvResponse("deals", toCsv(
      ["Deal", "Value", "Pipeline", "Stage", "Status", "Contact", "Company", "Owner", "Created", "Closed"],
      rows.map((d) => [d.title, Number(d.value), d.pipelines?.name, d.stages?.name, d.status,
        d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}`.trim() : "", d.companies?.name, d.profiles?.full_name, isoDate(d.created_at), isoDate(d.closed_at)])
    ));
  }

  // ----- One contact's timeline -----
  async function timeline() {
    type Row = { type: string; outcome: string | null; notes: string | null; next_step: string | null; created_at: string; profiles: { full_name: string } | null };
    const contactId = param("contact");
    if (!contactId) return new Response("Missing contact.", { status: 400 });
    const { data: contact } = await supabase.from("contacts").select("first_name, last_name").eq("id", contactId).maybeSingle();
    if (!contact) return new Response("Contact not found.", { status: 404 });
    const rows = await fetchAll<Row>((from, to) =>
      supabase.from("activities").select("type, outcome, notes, next_step, created_at, profiles:user_id(full_name)")
        .eq("contact_id", contactId).order("created_at", { ascending: false }).order("id").range(from, to).overrideTypes<Row[], { merge: false }>()
    );
    return csvResponse(`timeline-${`${contact.first_name}-${contact.last_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, toCsv(
      ["Date", "Type", "Outcome", "Notes", "Next Step", "Logged By"],
      rows.map((a) => [a.created_at.replace("T", " ").slice(0, 16), a.type, a.outcome, a.notes, a.next_step, a.profiles?.full_name])
    ));
  }
}
