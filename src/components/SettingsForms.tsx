"use client";

import { useActionState } from "react";
import type { MessageState } from "@/lib/contacts";

type Action = (prev: MessageState, formData: FormData) => Promise<MessageState>;
const label = "mb-1 block text-sm font-medium text-slate-700";

function Notice({ state }: { state: MessageState }) {
  if (state?.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function ProfileForm({ action, defaults }: { action: Action; defaults: { full_name: string; job_title: string | null; phone: string | null } }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Your name</span>
          <input name="full_name" required defaultValue={defaults.full_name} maxLength={80} className="input" />
        </label>
        <label className="block">
          <span className={label}>Job title</span>
          <input name="job_title" defaultValue={defaults.job_title ?? ""} maxLength={80} placeholder="e.g. Sales Manager" className="input" />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input name="phone" type="tel" defaultValue={defaults.phone ?? ""} maxLength={40} placeholder="+61 400 000 000" className="input" />
        </label>
      </div>
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(async (prev: MessageState, fd: FormData) => action(prev, fd), undefined);
  return (
    <form action={formAction} className="space-y-3" key={state?.message ? "done" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>New password</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </label>
        <label className="block">
          <span className={label}>Repeat it</span>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </label>
      </div>
      <p className="text-xs text-slate-400">At least 8 characters.</p>
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}

export function AddMemberForm({ action, roles }: { action: Action; roles: { id: string; name: string; description: string | null }[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3" key={state?.message ? "done" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={label}>Full name</span><input name="full_name" required maxLength={80} className="input" /></label>
        <label className="block"><span className={label}>Email</span><input name="email" type="email" required className="input" /></label>
        <label className="block">
          <span className={label}>Role</span>
          <select name="role_id" defaultValue={roles.find((r) => r.name === "Rep")?.id ?? roles[0]?.id} className="input">
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="block"><span className={label}>Starting password</span><input name="password" type="text" required minLength={8} autoComplete="off" placeholder="At least 8 characters" className="input" /></label>
      </div>
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add team member"}</button>
    </form>
  );
}

export function MemberControls({
  userId, roleId, roles, isYou, locked, changeRole, remove,
}: {
  userId: string; roleId: string | null; roles: { id: string; name: string }[]; isYou: boolean; locked: boolean;
  changeRole: (userId: string, prev: MessageState, fd: FormData) => Promise<MessageState>;
  remove: (userId: string) => Promise<MessageState>;
}) {
  const [state, formAction, pending] = useActionState(changeRole.bind(null, userId), undefined);
  const [removed, removeAction, removing] = useActionState(async () => remove(userId), undefined);
  if (locked) return <p className="text-xs text-slate-400">Only an Owner can change this person</p>;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <form action={formAction} className="flex items-center gap-2">
          <select name="role_id" defaultValue={roleId ?? ""} className="input !w-36 !py-1.5 text-xs" aria-label="Role">
            {!roleId && <option value="">No role</option>}
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={pending}>{pending ? "…" : "Save"}</button>
        </form>
        {!isYou && (
          <form
            action={removeAction}
            onSubmit={(e) => { if (!confirm("Remove this person? Their contacts, deals and tasks will be handed over to you.")) e.preventDefault(); }}
          >
            <button className="btn-secondary !px-3 !py-1.5 text-xs !text-red-600 hover:!bg-red-50" disabled={removing}>{removing ? "…" : "Remove"}</button>
          </form>
        )}
      </div>
      {(state?.error || removed?.error) && <p className="max-w-[260px] text-right text-xs text-red-600">{state?.error ?? removed?.error}</p>}
      {state?.message && <p className="text-xs text-emerald-600">{state.message}</p>}
    </div>
  );
}

export function NewRoleForm({ action, roles }: { action: Action; roles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3" key={state?.message ? "done" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={label}>Role name</span><input name="name" required maxLength={40} placeholder="e.g. Team Lead" className="input" /></label>
        <label className="block">
          <span className={label}>Start from</span>
          <select name="copy_from" defaultValue="" className="input">
            <option value="">Nothing switched on</option>
            {roles.map((r) => <option key={r.id} value={r.id}>Copy of {r.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block"><span className={label}>Description (optional)</span><input name="description" maxLength={120} className="input" /></label>
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create role"}</button>
    </form>
  );
}

export function SharingForm({
  action, members, meId, canPickFrom,
}: { action: Action; members: { id: string; full_name: string }[]; meId: string; canPickFrom: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Share the records of</span>
          {canPickFrom ? (
            <select name="from_user" defaultValue={meId} className="input">{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.id === meId ? " (you)" : ""}</option>)}</select>
          ) : (
            <input disabled value="You" className="input bg-slate-50" />
          )}
        </label>
        <label className="block">
          <span className={label}>With</span>
          <select name="to_user" defaultValue="" required className="input">
            <option value="" disabled>Choose a person</option>
            {members.filter((m) => m.id !== meId || canPickFrom).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>They can</span>
          <select name="access" defaultValue="view" className="input">
            <option value="view">View only</option>
            <option value="edit">View and edit</option>
          </select>
        </label>
      </div>
      <Notice state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save sharing rule"}</button>
    </form>
  );
}
