import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { todaysPick } from "@/lib/sales-content";
import { startOfToday } from "@/lib/dates";

export default async function WelcomePage() {
  const { supabase, profile } = await requireProfile();
  await supabase.rpc("refresh_stale_leads");
  const { count: staleCount } = await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("is_stale", true);
  const dayStart = startOfToday().getTime();
  const { data: open } = await supabase.from("tasks").select("due_at").eq("done", false);
  const dueToday = (open ?? []).filter((t) => { const d = new Date(t.due_at).getTime(); return d >= dayStart && d < dayStart + 86_400_000; }).length;
  const overdue = (open ?? []).filter((t) => new Date(t.due_at).getTime() < dayStart).length;
  const { quote, fact } = todaysPick();
  const firstName = profile.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-4xl pt-4">
      <section className="relative overflow-hidden rounded-2xl bg-sidebar px-10 py-12 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl" aria-hidden />
        <p className="relative text-sm font-medium text-teal-300">{today}</p>
        <h1 className="relative mt-2 text-4xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="relative mt-3 max-w-xl text-slate-300">
          Every lead has an owner and a next step. Let&apos;s make sure nothing slips today.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2 text-sm">
          <Link href="/tasks?tab=today" className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
            <b>{dueToday}</b> {dueToday === 1 ? "task" : "tasks"} due today
          </Link>
          <Link href="/tasks?tab=overdue" className={`rounded-full px-3 py-1 ${overdue ? "bg-red-500/30 hover:bg-red-500/40" : "bg-white/10 hover:bg-white/20"}`}>
            <b>{overdue}</b> overdue
          </Link>
          <Link href="/contacts?stale=1" className={`rounded-full px-3 py-1 ${staleCount ? "bg-amber-400/25 hover:bg-amber-400/35" : "bg-white/10 hover:bg-white/20"}`}>
            <b>{staleCount ?? 0}</b> stale {staleCount === 1 ? "lead" : "leads"}
          </Link>
        </div>
        <div className="relative mt-7 flex flex-wrap gap-3">
          <Link href="/contacts" className="btn-primary">Go to contacts</Link>
          <Link href="/pipelines" className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Open pipelines
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-5">
        <figure className="card p-7 md:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Quote of the day</p>
          <blockquote className="mt-3 text-xl font-medium leading-snug text-slate-900">&ldquo;{quote.text}&rdquo;</blockquote>
          <figcaption className="mt-4 text-sm text-slate-500">{quote.author}</figcaption>
        </figure>
        <div className="card bg-accent-soft/60 p-7 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Did you know?</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{fact}</p>
        </div>
      </div>
    </div>
  );
}
