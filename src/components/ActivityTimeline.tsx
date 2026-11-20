import { TYPE_ICON, TYPE_LABEL, type ActivityType } from "@/lib/activities";
import { deleteActivity } from "@/app/(app)/contacts/[id]/activity-actions";

export type TimelineItem = {
  id: string;
  type: ActivityType;
  outcome: string | null;
  notes: string | null;
  next_step: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  deals: { title: string } | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function ActivityTimeline({ items, contactId, canDelete = true }: { items: TimelineItem[]; contactId: string; canDelete?: boolean }) {
  if (items.length === 0) {
    return <div className="card p-10 text-center text-sm text-slate-500">No activity yet. Log the first call, email, note or meeting above.</div>;
  }
  return (
    <ol className="card divide-y divide-slate-100">
      {items.map((a) => (
        <li key={a.id} className="flex gap-4 p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={TYPE_ICON[a.type]} /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{TYPE_LABEL[a.type]}</span>
              {a.outcome && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{a.outcome}</span>}
              {a.deals && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">{a.deals.title}</span>}
            </div>
            {a.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{a.notes}</p>}
            {a.next_step && (
              <p className="mt-2 inline-block rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">
                <b>Next step:</b> {a.next_step}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">{a.profiles?.full_name ?? "Someone"} · {when(a.created_at)}</p>
          </div>
          {canDelete && (
            <form action={deleteActivity.bind(null, a.id, contactId)}>
              <button className="text-xs text-slate-400 hover:text-red-600" aria-label="Delete activity">Delete</button>
            </form>
          )}
        </li>
      ))}
    </ol>
  );
}
