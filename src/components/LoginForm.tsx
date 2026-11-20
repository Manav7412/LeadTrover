"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "@/app/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-2 w-full rounded-full bg-gradient-to-r from-cyan-300 to-teal-400 py-3 text-sm font-semibold text-slate-900 shadow-[0_0_30px_-4px_rgba(34,211,238,0.65)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? "Signing in…" : "Log in"}
    </button>
  );
}

const field =
  "w-full rounded-full border border-cyan-400/30 bg-slate-950/60 px-5 py-3 text-sm text-white placeholder:text-slate-500 transition focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30";

export default function LoginForm({ hasError }: { hasError: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <form action={login} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-300">Email</span>
        <input name="email" type="email" required autoComplete="email" placeholder="name@company.com" className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-300">Password</span>
        <div className="relative">
          <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" className={`${field} pr-16`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-cyan-300 hover:text-cyan-200"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      {hasError && (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          Wrong email or password. Please try again.
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
