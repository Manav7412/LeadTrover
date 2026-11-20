import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import KanbanBoard from "@/components/KanbanBoard";
import { formatMoney, type BoardDeal } from "@/lib/deals";
import { can } from "@/lib/permissions";

type DealRow = {
  id: string; title: string; value: number; stage_id: string; status: string; created_at: string;
  contacts: { first_name: string; last_name: string } | null;
  companies: { name: string } | null;
  profiles: { full_name: string } | null;
};

export default async function PipelinesPage({ searchParams }: PageProps<"/pipelines">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();

  const { data: pipelines } = await supabase.from("pipelines").select("id, name").order("position");
  const list = pipelines ?? [];
  const selected = list.find((p) => p.id === sp.p) ?? list[0];
  if (!selected) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <p className="font-medium text-slate-900">No pipelines yet</p>
        <p className="mt-1 text-sm text-slate-500">Create your first pipeline to start tracking deals.</p>
        {can(profile, "pipelines.manage") && <Link href="/pipelines/new" className="btn-primary mt-4">+ New pipeline</Link>}
      </div>
    );
  }

  const [{ data: stages }, { data }] = await Promise.all([
    supabase.from("stages").select("id, name, outcome").eq("pipeline_id", selected.id).order("position"),
    supabase
      .from("deals")
      .select("id, title, value, stage_id, status, created_at, contacts(first_name, last_name), companies(name), profiles:owner_id(full_name)")
      .eq("pipeline_id", selected.id)
      .order("created_at", { ascending: false })
      .overrideTypes<DealRow[], { merge: false }>(),
  ]);

  const rows = data ?? [];
  const deals: BoardDeal[] = rows.map((d) => ({
    id: d.id, title: d.title, value: Number(d.value), stage_id: d.stage_id, createdAt: d.created_at,
    contactName: d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}`.trim() : "No contact",
    companyName: d.companies?.name ?? "",
    ownerName: d.profiles?.full_name ?? "Unassigned",
  }));
  const sum = (status: string) => rows.filter((d) => d.status === status).reduce((s, d) => s + Number(d.value), 0);
  const count = (status: string) => rows.filter((d) => d.status === status).length;

  const stats: [string, string][] = [
    ["Open deals", `${count("open")} · ${formatMoney(sum("open"))}`],
    ["Won", `${count("won")} · ${formatMoney(sum("won"))}`],
    ...((stages ?? []).some((s) => s.outcome === "lost") ? ([["Lost", `${count("lost")} · ${formatMoney(sum("lost"))}`]] as [string, string][]) : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pipelines</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {profile.scope === "all" ? "Everyone's deals" : "Your deals"}. Drag a card to move it to another stage.
          </p>
        </div>
        <div className="flex gap-2">
          {can(profile, "contacts.export") && <a href={`/export/deals?p=${selected.id}`} className="btn-secondary" download>Export CSV</a>}
          {can(profile, "deals.create") && <Link href={`/deals/new?p=${selected.id}`} className="btn-primary">+ Add deal</Link>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/pipelines?p=${p.id}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${p.id === selected.id ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {p.name}
            </Link>
          ))}
          {can(profile, "pipelines.manage") && <Link href="/pipelines/new" className="rounded-md px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">+ New pipeline</Link>}
        </div>
        {can(profile, "pipelines.manage") && <Link href={`/pipelines/${selected.id}/edit`} className="btn-secondary !py-1.5 text-xs">Edit pipeline</Link>}
        <div className="ml-auto flex gap-2">
          {stats.map(([label, value]) => (
            <span key={label} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
              {label}: <b className="text-slate-900">{value}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <KanbanBoard key={selected.id} pipelineId={selected.id} stages={stages ?? []} deals={deals} canMove={can(profile, "deals.edit")} canAdd={can(profile, "deals.create")} />
      </div>
    </div>
  );
}
