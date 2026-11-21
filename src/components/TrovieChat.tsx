"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

type Msg = { role: "user" | "assistant"; content: string; failed?: boolean };

export const SUGGESTIONS = [
  "Who needs a follow-up today?",
  "Show my stale leads",
  "Summarize my pipeline",
  "What should I do next?",
];

// ---------- a tiny, safe markdown reader: **bold**, `code`, - lists, and [links](/inside-the-app) ----------
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(\/[^)\s]*\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={i++} className="font-semibold text-slate-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={i++} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>);
    else { const [, label, href] = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(tok)!; out.push(<Link key={i++} href={href} className="font-medium text-accent underline-offset-2 hover:underline">{label}</Link>); }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag key={bi} className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-slate-400`}>
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>)}
            </Tag>
          );
        }
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </div>
  );
}

// ---------- the chat drawer ----------
export default function TrovieChat({ open, onClose, firstName, startWith, onBusy }: {
  open: boolean; onClose: () => void; firstName: string; startWith: { text: string; n: number } | null; onBusy: (busy: boolean) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const handled = useRef(0);
  const history = useRef<Msg[]>([]);
  history.current = messages;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, status]);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const sent: Msg[] = [...history.current.filter((m) => !m.failed && m.content), { role: "user", content: q }];
    setMessages([...history.current, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setDraft(""); setBusy(true); setStatus("Thinking…");
    const controller = new AbortController(); abort.current = controller;
    const patchLast = (fn: (m: Msg) => Msg) => setMessages((all) => all.map((m, i) => (i === all.length - 1 ? fn(m) : m)));
    try {
      const res = await fetch("/api/trovie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: sent.slice(-12) }), signal: controller.signal });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        patchLast((m) => ({ ...m, content: err?.error ?? "I couldn't reach my brain just now. Please try again.", failed: true }));
        return;
      }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const line = buffer.slice(0, cut).trim(); buffer = buffer.slice(cut + 2);
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5));
          if (ev.t === "text") { setStatus(null); patchLast((m) => ({ ...m, content: m.content + ev.delta })); }
          else if (ev.t === "status") setStatus(ev.text);
          else if (ev.t === "error") patchLast((m) => ({ ...m, content: ev.message, failed: true }));
          else if (ev.t === "done") setRemaining(ev.remaining);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") patchLast((m) => ({ ...m, content: m.content || "I lost my connection. Please try again.", failed: !m.content }));
    } finally {
      setBusy(false); setStatus(null); abort.current = null;
    }
  }

  // a question typed in the Home page bar starts the conversation
  useEffect(() => {
    if (startWith && startWith.n !== handled.current) { handled.current = startWith.n; void ask(startWith.text); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWith]);

  if (!open) return null;
  const empty = messages.length === 0;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[1px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="flex h-full w-full max-w-[28rem] flex-col bg-white shadow-2xl" role="dialog" aria-label="Chat with Trovie">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/trovie-head.png" alt="" className="h-8 w-8 object-cover object-top" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Trovie</p>
            <p className="text-xs text-slate-500">Your AI sales assistant{remaining !== null ? ` · ${remaining} questions left today` : ""}</p>
          </div>
          {!empty && <button className="text-xs text-slate-500 hover:text-accent" onClick={() => { abort.current?.abort(); setMessages([]); setStatus(null); setBusy(false); }}>New chat</button>}
          <button onClick={onClose} aria-label="Close chat" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-slate-700">
          {empty && (
            <div className="pt-6 text-center">
              <p className="text-lg font-light text-slate-900">Hi {firstName}, what can I help with?</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">I can look at your leads, tasks and deals and suggest what to do next. I can&apos;t change anything yet.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => void ask(s)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-accent hover:text-accent">{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-white">{m.content}</p>
              ) : m.failed ? (
                <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-amber-900">{m.content}</p>
              ) : m.content ? <Markdown text={m.content} /> : null}
            </div>
          ))}
          {busy && status && <p className="flex items-center gap-2 text-xs text-slate-400"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />{status}</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void ask(draft); }} className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-4 pr-1.5 focus-within:border-slate-300">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1500} placeholder="Ask Trovie…" aria-label="Message Trovie" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none" autoFocus />
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} className="rounded-full bg-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-300">Stop</button>
            ) : (
              <button disabled={!draft.trim()} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-30">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">Trovie can make mistakes. Check important details.</p>
        </form>
      </aside>
    </div>
  );
}
