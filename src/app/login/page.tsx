import Image from "next/image";
import CircuitBackground from "@/components/CircuitBackground";
import LoginForm from "@/components/LoginForm";
import { login } from "./actions";

const DEMO_PASSWORD = "LeadTrove-demo-1"; // fake demo accounts only

const BULLETS = ["Centralized pipeline", "Smart follow-ups", "An owner and a next step on every lead"];

function Check() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-teal-300 ring-1 ring-teal-300/40">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
    </span>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030b16] text-white">
      <CircuitBackground />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center gap-16 px-5 py-10 lg:justify-between lg:px-12">
        {/* left: the pitch (hidden on small screens) */}
        <section className="hidden max-w-sm lg:block xl:max-w-md">
          <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-5xl font-light leading-[1.08] tracking-tight text-transparent xl:text-6xl">
            Never Miss<br />a Follow-Up.
          </h1>
          <ul className="mt-9 space-y-4">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-base text-slate-200 xl:text-lg"><Check />{b}</li>
            ))}
          </ul>
        </section>

        {/* right: the login card */}
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_0_90px_-25px_rgba(34,211,238,0.55)] backdrop-blur-xl sm:p-9">
            <div className="flex items-center justify-center gap-3">
              <Image src="/logo-icon-glow.png" alt="" width={44} height={44} className="h-11 w-11" priority />
              <span className="text-3xl font-semibold tracking-tight text-white">LeadTrove</span>
            </div>
            <h2 className="mt-6 text-center text-2xl font-semibold leading-tight">Welcome back!<br />Log in to LeadTrove</h2>
            <p className="mt-2 text-center text-sm text-slate-400">Manage your pipelines, tasks, and leads.</p>

            <div className="mt-7"><LoginForm hasError={Boolean(error)} /></div>

            <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-white/10" />Try a demo account<span className="h-px flex-1 bg-white/10" />
            </div>
            <form action={login}>
              <input type="hidden" name="email" value="guest@leadtrove.demo" />
              <input type="hidden" name="password" value={DEMO_PASSWORD} />
              <button className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left transition hover:border-cyan-300/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60">
                <span className="block text-sm font-medium text-white">Guest</span>
                <span className="block text-xs text-slate-400">Read-only · look around, nothing can be changed</span>
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">Don&apos;t have an account? Ask your administrator to add you.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
