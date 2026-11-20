// Simple charts built from plain HTML and CSS (no chart library).
// Marks are thin, bars have a 4px rounded data-end, one accent colour, text uses text colours,
// and every mark has a hover tooltip. Every chart can also be read as a table.
import type { ReactNode } from "react";

export function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const TIP =
  "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

// A readable table version of the same data, for anyone who prefers numbers (or can't tell colours apart).
export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-4 text-xs">
      <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-800">View as table</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>{columns.map((c, i) => <th key={c} className={`px-3 py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => <td key={j} className={`px-3 py-1.5 ${j > 0 ? "text-right tabular-nums" : ""}`}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// Round the top of the scale up to a clean number (5, 10, 20, 50...).
function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export type ColumnDatum = { label: string; value: number; tip: string };

export function ColumnChart({ data, unit }: { data: ColumnDatum[]; unit: string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const every = Math.ceil(data.length / 7);
  const ticks = [max, max / 2, 0];
  return (
    <div role="img" aria-label={`${unit} per day. Highest day: ${Math.max(0, ...data.map((d) => d.value))}.`}>
      <div className="flex">
        <div className="flex h-48 w-8 flex-col justify-between pr-2 text-right text-[11px] leading-none text-slate-400 tabular-nums">
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="relative h-48 flex-1">
          {[0, 50, 100].map((p) => <div key={p} className="absolute inset-x-0 border-t border-slate-100" style={{ top: `${p}%` }} />)}
          <div className="absolute inset-0 flex items-end gap-1">
            {data.map((d, i) => (
              <div key={i} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none">
                <div
                  className="w-full max-w-[22px] rounded-t-[4px] bg-accent group-hover:bg-accent-dark group-focus-visible:bg-accent-dark"
                  style={{ height: d.value > 0 ? `max(3px, ${(d.value / max) * 100}%)` : 0 }}
                />
                <span className={TIP}>{d.tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-8 mt-2 flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="relative h-4 flex-1">
            {i % every === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400">{d.label}</span>}
          </div>
        ))}
      </div>
      <DataTable columns={["Day", unit]} rows={data.map((d) => [d.label, d.value])} />
    </div>
  );
}

export type BarDatum = { label: string; value: number; display: string; tip?: string };

export function BarList({ data, unit, empty }: { data: BarDatum[]; unit: string; empty: string }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <p className="py-10 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div>
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.label} tabIndex={0} className="group relative flex items-center gap-3 outline-none">
            <span className="w-32 shrink-0 truncate text-sm text-slate-600" title={d.label}>{d.label}</span>
            <div className="flex flex-1 items-center gap-2">
              <div
                className="h-4 rounded-r-[4px] bg-accent group-hover:bg-accent-dark group-focus-visible:bg-accent-dark"
                style={{ width: d.value > 0 ? `max(3px, ${(d.value / (max * 1.25)) * 100}%)` : 0 }}
              />
              <span className="text-sm font-medium tabular-nums text-slate-800">{d.display}</span>
            </div>
            <span className={`${TIP} !left-32 !translate-x-0`}>{d.tip ?? `${d.label}: ${d.display}`}</span>
          </li>
        ))}
      </ul>
      <DataTable columns={["", unit]} rows={data.map((d) => [d.label, d.display])} />
    </div>
  );
}
