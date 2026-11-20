"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type TrovieMood = "idle" | "typing" | "private";

const IDLE_LINES = [
  "Welcome back! I'm Trovie.",
  "Every lead needs an owner and a next step.",
  "Ready to follow up?",
  "I keep an eye on your stale leads.",
];
const MOOD_LINES: Record<Exclude<TrovieMood, "idle">, string> = {
  typing: "Nice to see you again!",
  private: "I won't peek, promise!",
};

// Trovie is built from two layers (head and body) so the head can move on its own.
// Measurements below are percentages of the picture, taken from the original artwork.
const HEAD_PIVOT = "48% 45.9%";

export default function Trovie({ mood = "idle", widthClass = "w-40" }: { mood?: TrovieMood; widthClass?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(0);
  const [hop, setHop] = useState(true);

  // Rotate friendly lines every few seconds while idle.
  useEffect(() => {
    const id = setInterval(() => setLine((n) => (n + 1) % IDLE_LINES.length), 5500);
    return () => clearInterval(id);
  }, []);

  // A little hello hop when the page opens.
  useEffect(() => {
    const id = setTimeout(() => setHop(false), 900);
    return () => clearTimeout(id);
  }, []);

  // The head turns toward the mouse. We write CSS variables directly so nothing re-renders.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = box.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
        const dy = (e.clientY - (r.top + r.height * 0.3)) / (window.innerHeight / 2);
        const cl = (v: number) => Math.max(-1, Math.min(1, v));
        el.style.setProperty("--look", `${cl(dx) * 6}deg`);
        el.style.setProperty("--lookx", `${cl(dx) * 4}px`);
        el.style.setProperty("--looky", `${cl(dy) * 3}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, []);

  const message = mood === "idle" ? IDLE_LINES[line] : MOOD_LINES[mood];
  const lively = mood === "typing";
  const eyesShut = mood === "private";

  return (
    <div className="relative w-fit select-none" role="img" aria-label="Trovie, your LeadTrove AI assistant">
      {/* speech bubble to the right of the head */}
      <p
        key={message}
        className="mascot-bubble absolute left-full top-[3%] z-20 ml-2 w-44 rounded-2xl border border-cyan-300/25 bg-slate-900/70 px-3.5 py-2.5 text-xs leading-snug text-cyan-50 shadow-[0_0_24px_-6px_rgba(34,211,238,0.5)] backdrop-blur"
      >
        {message}
        <span className="absolute -left-1.5 top-5 h-3 w-3 rotate-45 border-b border-l border-cyan-300/25 bg-slate-900/70" />
      </p>

      <div ref={box} className={`relative mx-auto ${widthClass}`} style={{ aspectRatio: "407 / 760" }}>
        {/* orbiting rings and dots behind Trovie */}
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-0 w-[170%]" style={{ aspectRatio: "1", transform: "translate(-50%, -50%) rotate(-14deg) scaleY(0.26)" }}>
          <div className="absolute inset-0 rounded-full border border-cyan-300/40" />
          <div className={`trovie-spin absolute inset-0 ${lively ? "is-lively" : ""}`}>
            <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_14px_5px_rgba(34,211,238,0.7)]" />
            <span className="absolute bottom-[12%] right-[8%] h-2 w-2 rounded-full bg-teal-200 shadow-[0_0_10px_3px_rgba(94,234,212,0.7)]" />
          </div>
        </div>

        {/* soft light on the floor */}
        <div className="pointer-events-none absolute -bottom-2 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-full bg-cyan-400/25 blur-md" />

        <div className={`absolute inset-0 z-10 ${hop ? "trovie-hop" : ""}`}>
          <div className={`trovie-bob absolute inset-0 ${lively ? "is-lively" : ""}`}>
            {/* body (breathes, chest glows) */}
            <div className="trovie-breathe absolute inset-0">
              <Image src="/trovie-body.png" alt="" width={407} height={760} unoptimized className="absolute inset-0 h-full w-full" />
              <span className="trovie-pulse pointer-events-none absolute left-[47%] top-[59.2%] h-[13%] w-[25%] rounded-full" style={{ background: "radial-gradient(circle, rgba(103,232,249,0.9), rgba(34,211,238,0) 70%)" }} />
            </div>

            {/* head: idle sway + turns toward the mouse; blinks; antenna glows */}
            <div className="absolute inset-0" style={{ transformOrigin: HEAD_PIVOT, transform: "translate(var(--lookx, 0px), var(--looky, 0px)) rotate(var(--look, 0deg))", transition: "transform 0.25s ease-out" }}>
              <div className="trovie-sway absolute inset-0" style={{ transformOrigin: HEAD_PIVOT }}>
                <Image src="/trovie-head.png" alt="" width={407} height={760} unoptimized className="absolute inset-0 h-full w-full" priority />
                {/* eyelids */}
                {[["34.9%", "26.8%", "20%"], ["62.7%", "27.5%", "23%"]].map(([left, top, width]) => (
                  <span
                    key={left}
                    className={`trovie-blink pointer-events-none absolute h-[7.5%] -translate-x-1/2 -translate-y-1/2 rounded-full ${eyesShut ? "is-shut" : ""}`}
                    style={{ left, top, width, background: "radial-gradient(ellipse, #0e1420 62%, rgba(14,20,32,0) 100%)" }}
                  />
                ))}
                <span className="trovie-pulse pointer-events-none absolute left-[52.4%] top-[1.7%] h-[5%] w-[9%] rounded-full" style={{ background: "radial-gradient(circle, rgba(103,232,249,0.95), rgba(34,211,238,0) 70%)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
