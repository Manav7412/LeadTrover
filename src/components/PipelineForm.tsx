"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/lib/contacts";
import type { StageOutcome } from "@/lib/deals";

type StageRow = { key: string; id?: string; name: string; outcome: StageOutcome };

// Ready-made starting points for a new pipeline.
const TEMPLATES: { label: string; stages: [string, StageOutcome][] }[] = [
  { label: "Sales", stages: [["New", "open"], ["Contacted", "open"], ["Proposal Sent", "open"], ["Won", "won"], ["Lost", "lost"]] },
  { label: "Recruitment", stages: [["Applied", "open"], ["Screening", "open"], ["Interview", "open"], ["Offer", "open"], ["Hired", "won"], ["Rejected", "lost"]] },
  { label: "Partnerships", stages: [["Idea", "open"], ["Intro Call", "open"], ["Negotiating", "open"], ["Partnered", "won"], ["Not a fit", "lost"]] },
];

let counter = 0;
const row = (name = "", outcome: StageOutcome = "open", id?: string): StageRow => ({ key: `k${counter++}`, id, name, outcome });

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: { name: string; stages: { id: string; name: string; outcome: StageOutcome }[] };
  showTemplates?: boolean;
  submitLabel: string;
  cancelHref: string;
};

const OUTCOME_LABEL: Record<StageOutcome, string> = { open: "In progress", won: "Won", lost: "Lost" };

export default function PipelineForm({ action, defaults, showTemplates = false, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [stages, setStages] = useState<StageRow[]>(() =>
    defaults ? defaults.stages.map((s) => row(s.name, s.outcome, s.id)) : [row("New"), row("In progress"), row("Won", "won"), row("Lost", "lost")]
  );

  const update = (key: string, patch: Partial<StageRow>) => setStages((l) => l.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setStages((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <label className="block">
        <span className={label}>Pipeline name *</span>
        <input name="name" required maxLength={60} defaultValue={defaults?.name} placeholder="e.g. Partnerships, Recruitment, Renewals" className="input" />
      </label>

      {showTemplates && (
        <div>
          <span className={label}>Start from a template (optional)</span>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setStages(t.stages.map(([n, o]) => row(n, o)))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className={label}>Stages (left to right on the board) *</span>
        <ul className="space-y-2">
          {stages.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
              <input value={s.name} onChange={(e) => update(s.key, { name: e.target.value })} maxLength={40} placeholder="Stage name" className="input" aria-label={`Stage ${i + 1} name`} />
              <select value={s.outcome} onChange={(e) => update(s.key, { outcome: e.target.value as StageOutcome })} className="input !w-36" aria-label="Stage type">
                {(Object.keys(OUTCOME_LABEL) as StageOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
              </select>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="btn-secondary !px-2 !py-2" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="btn-secondary !px-2 !py-2" aria-label="Move down">↓</button>
              <button type="button" onClick={() => setStages((l) => l.filter((x) => x.key !== s.key))} disabled={stages.length === 1} className="btn-secondary !px-2 !py-2 !text-red-600" aria-label="Remove stage">✕</button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setStages((l) => [...l, row()])} disabled={stages.length >= 12} className="btn-secondary mt-3 !py-1.5 text-xs">+ Add stage</button>
        <p className="mt-2 text-xs text-slate-400">
          &quot;Won&quot; and &quot;Lost&quot; stages close a deal and count towards win rate. Everything else is &quot;In progress&quot;.
        </p>
      </div>

      <input type="hidden" name="stages" value={JSON.stringify(stages.map(({ id, name, outcome }) => ({ id, name, outcome })))} />
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
