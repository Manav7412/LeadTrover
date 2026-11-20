"use client";

import { useState } from "react";
import Mascot from "./Mascot";

// A look-and-feel placeholder for the AI assistant. It doesn't send anything yet.
export default function AskBar({ firstName }: { firstName: string }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <section className="mt-8">
      {/* heading on the left, mascot on the right standing on the top edge of the bar */}
      <div className="relative flex flex-col items-center sm:flex-row sm:items-end sm:justify-end sm:gap-6">
        <h2 className="pb-3 text-center text-2xl font-light tracking-tight text-slate-900 sm:absolute sm:inset-x-0 sm:bottom-5 sm:z-10 sm:pb-0 sm:text-[1.65rem]">What&apos;s on your mind, {firstName}?</h2>
        <div className="relative z-0 -mb-4 pt-12 sm:mr-6">
          <Mascot excited={focused || text.length > 0} widthClass="w-32" />
        </div>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) setNote(true); }}
        className="relative z-10 flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-3 pr-2 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.18)] focus-within:border-slate-300"
      >
        <button type="button" aria-label="Add attachment" onClick={() => setNote(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <input
          value={text} onChange={(e) => { setText(e.target.value); setNote(false); }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={`Ask anything… with your personal AI Assistant, ${firstName}`} aria-label="Ask your personal AI Assistant"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button type="button" aria-label="Voice input" onClick={() => setNote(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>
        <button aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white hover:bg-slate-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><rect x="5" y="9" width="2" height="6" rx="1" /><rect x="9" y="5" width="2" height="14" rx="1" /><rect x="13" y="8" width="2" height="8" rx="1" /><rect x="17" y="10.5" width="2" height="3" rx="1" /></svg>
        </button>
      </form>
      <p className={`mt-3 text-center text-sm ${note ? "text-accent" : "text-transparent"}`} aria-live="polite">
        The LeadTrove assistant is coming soon. This box isn&apos;t connected yet.
      </p>
    </section>
  );
}
