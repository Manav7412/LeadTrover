"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { formatMoney, type BoardDeal, type BoardStage } from "@/lib/deals";
import { moveDeal } from "@/app/(app)/pipelines/actions";

const dot = (outcome: string) => (outcome === "won" ? "bg-emerald-500" : outcome === "lost" ? "bg-red-400" : "bg-accent");

function age(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : `${d}d`;
}

export default function KanbanBoard({ pipelineId, stages, deals, canMove = true, canAdd = true }: { pipelineId: string; stages: BoardStage[]; deals: BoardDeal[]; canMove?: boolean; canAdd?: boolean }) {
  const [, startTransition] = useTransition();
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The card jumps to its new column instantly; if the save fails it jumps back.
  const [shown, moveLocally] = useOptimistic(deals, (state, m: { id: string; stageId: string }) =>
    state.map((d) => (d.id === m.id ? { ...d, stage_id: m.stageId } : d))
  );

  function drop(stageId: string, e: React.DragEvent) {
    e.preventDefault();
    setOverStage(null);
    if (!canMove) return;
    const id = e.dataTransfer.getData("text/plain");
    const deal = shown.find((d) => d.id === id);
    if (!deal || deal.stage_id === stageId) return;
    setError(""); setNotice("");
    startTransition(async () => {
      moveLocally({ id, stageId });
      const res = await moveDeal(id, stageId);
      if (res.error) setError(res.error);
      if (res.notice) setNotice(res.notice);
    });
  }

  return (
    <div>
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid auto-cols-[minmax(210px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const items = shown.filter((d) => d.stage_id === stage.id);
          const total = items.reduce((s, d) => s + d.value, 0);
          return (
            <section
              key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => drop(stage.id, e)}
              className={`flex min-h-[420px] flex-col rounded-xl border p-2 transition-colors ${
                overStage === stage.id ? "border-accent bg-accent-soft" : "border-slate-200 bg-slate-100/60"
              }`}
            >
              <header className="px-2 pb-2 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className={`h-2 w-2 rounded-full ${dot(stage.outcome)}`} />
                    {stage.name}
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{items.length}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{formatMoney(total)}</p>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {items.map((d) => (
                  <article
                    key={d.id}
                    draggable={canMove}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", d.id); e.dataTransfer.effectAllowed = "move"; }}
                    className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 hover:shadow ${canMove ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <Link href={`/deals/${d.id}`} draggable={false} className="text-sm font-medium leading-snug text-slate-900 hover:text-accent">
                      {d.title}
                    </Link>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{formatMoney(d.value)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {d.contactName}{d.companyName && ` · ${d.companyName}`}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span title={d.ownerName} className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
                        {d.ownerName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">{age(d.createdAt)}</span>
                    </div>
                  </article>
                ))}
                {canAdd && <Link
                  href={`/deals/new?p=${pipelineId}&s=${stage.id}`}
                  className="mt-auto rounded-lg border border-dashed border-slate-300 py-1.5 text-center text-xs font-medium text-slate-500 hover:border-accent hover:text-accent"
                >
                  + Add deal
                </Link>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
