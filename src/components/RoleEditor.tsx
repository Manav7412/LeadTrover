"use client";

import { useActionState, useState } from "react";
import { PERMISSION_GROUPS, type DataScope } from "@/lib/permissions";
import type { MessageState } from "@/lib/contacts";

type Role = { id: string; name: string; description: string | null; is_system: boolean; data_scope: DataScope; permissions: Record<string, boolean> };

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "bg-accent" : "bg-slate-300"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

export default function RoleEditor({
  role, canEdit, save, remove, memberCount,
}: {
  role: Role; canEdit: boolean; memberCount: number;
  save: (prev: MessageState, fd: FormData) => Promise<MessageState>;
  remove: () => Promise<MessageState>;
}) {
  const locked = role.name === "Owner";
  const editable = canEdit && !locked;
  const [scope, setScope] = useState<DataScope>(role.data_scope);
  const [perms, setPerms] = useState<Record<string, boolean>>(role.permissions);
  const [state, formAction, pending] = useActionState(save, undefined);
  const [removed, removeAction, removing] = useActionState(async () => remove(), undefined);
  const set = (key: string, v: boolean) => setPerms((p) => ({ ...p, [key]: v }));
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="space-y-5">
      <form action={formAction} className="card space-y-6 p-6">
        <input type="hidden" name="data_scope" value={scope} />
        <input type="hidden" name="permissions" value={JSON.stringify(perms)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Role name</span>
            <input name="name" defaultValue={role.name} disabled={!editable || role.is_system} maxLength={40} className="input disabled:bg-slate-50" />
          </label>
          <label className="block">
            <span className={label}>Description</span>
            <input name="description" defaultValue={role.description ?? ""} disabled={!editable || role.is_system} className="input disabled:bg-slate-50" />
          </label>
        </div>
        {locked && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">The Owner role is locked: it can always do everything and see everything.</p>}
        {!canEdit && !locked && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">You can look at this role, but only people who manage roles can change it.</p>}

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Data visibility</h3>
          <p className="mb-3 mt-0.5 text-sm text-slate-500">Which contacts, deals and tasks can people in this role see?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["own", "Only their own records", "Leads, deals and tasks assigned to them, plus anything shared with them."],
              ["all", "Everyone's records", "All leads, deals and tasks across the team."],
            ] as const).map(([value, title, hint]) => (
              <button
                key={value} type="button" disabled={!editable} onClick={() => setScope(value)}
                className={`rounded-xl border p-4 text-left transition ${scope === value ? "border-accent bg-accent-soft" : "border-slate-200 hover:bg-slate-50"} ${!editable ? "cursor-not-allowed opacity-70" : ""}`}
                aria-pressed={scope === value}
              >
                <span className="block text-sm font-medium text-slate-900">{title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {PERMISSION_GROUPS.map((g) => {
            const allOn = g.items.every((i) => locked || perms[i.key]);
            return (
              <div key={g.title}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
                  {editable && (
                    <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => g.items.forEach((i) => set(i.key, !allOn))}>
                      {allOn ? "Turn all off" : "Turn all on"}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {g.items.map((i) => (
                    <li key={i.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{i.label}</p>
                        <p className="text-xs text-slate-500">{i.hint}</p>
                      </div>
                      <Switch on={locked || perms[i.key] === true} onChange={(v) => set(i.key, v)} disabled={!editable} label={i.label} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state?.message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}
        {editable && <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save role"}</button>}
      </form>

      {editable && !role.is_system && (
        <form
          action={removeAction}
          onSubmit={(e) => { if (!confirm(`Delete the "${role.name}" role?`)) e.preventDefault(); }}
          className="card flex items-center justify-between gap-4 p-5"
        >
          <div>
            <p className="text-sm font-medium text-slate-900">Delete this role</p>
            <p className="text-xs text-slate-500">{memberCount > 0 ? `${memberCount} ${memberCount === 1 ? "person uses" : "people use"} it, so give them another role first.` : "Nobody uses it, so it can be deleted."}</p>
            {removed?.error && <p className="mt-1 text-xs text-red-600">{removed.error}</p>}
          </div>
          <button className="btn-secondary !text-red-600 hover:!bg-red-50" disabled={removing}>{removing ? "…" : "Delete role"}</button>
        </form>
      )}
    </div>
  );
}
