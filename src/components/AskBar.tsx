"use client";

import { useState } from "react";

// A look-and-feel placeholder for the AI assistant. It doesn't send anything yet.
export default function AskBar({ firstName }: { firstName: string }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  return (
    <section className="mt-8 text-center">
      <h2 className="text-2xl font-light tracking-tight text-slate-900 sm:text-3xl">What&apos;s on your mind, {firstName}?</h2>
      <form
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) setNote(true); }}
        className="mx-auto mt-5 flex max-w-2xl items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-3 pr-2 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.18)] focus-within:border-slate-300"
      >
        <button type="button" aria-label="Add attachment" onClick={() => setNote(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <input
          value={text} onChange={(e) => { setText(e.target.value); setNote(false); }}
          placeholder="Ask anything…" aria-label="Ask anything"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button type="button" aria-label="Voice input" onClick={() => setNote(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>
        <button aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white hover:bg-slate-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><rect x="5" y="9" width="2" height="6" rx="1" /><rect x="9" y="5" width="2" height="14" rx="1" /><rect x="13" y="8" width="2" height="8" rx="1" /><rect x="17" y="10.5" width="2" height="3" rx="1" /></svg>
        </button>
      </form>
      <p className={`mt-3 text-sm ${note ? "text-accent" : "text-transparent"}`} aria-live="polite">
        The LeadTrove assistant is coming soon. This box isn&apos;t connected yet.
      </p>
    </section>
  );
}
