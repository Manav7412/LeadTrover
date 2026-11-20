"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const TIPS = [
  "Hi! I'm your LeadTrove assistant.",
  "Soon you can ask me who needs a follow-up today.",
  "Try: “Show my stale leads”.",
  "I'll help you log calls and book meetings.",
  "Every lead needs an owner and a next step!",
];

// The animated AI mascot. It floats, glows, follows the mouse a little, and gets excited when you type.
export default function Mascot({ excited = false }: { excited?: boolean }) {
  const [tip, setTip] = useState(0);
  const [shift, setShift] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 5000);
    return () => clearInterval(id);
  }, []);

  // Lean a few pixels toward the mouse.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      setShift(Math.max(-1, Math.min(1, dx * 2)) * 8);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const message = excited ? "I'm listening…" : TIPS[tip];
  return (
    <div ref={box} className="mascot-hover relative mx-auto w-44 shrink-0 select-none sm:mx-0" aria-hidden>
      <p key={message} className="mascot-bubble absolute -top-1 left-1/2 z-10 w-44 -translate-x-1/2 -translate-y-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-xs leading-snug text-slate-600 shadow-sm">
        {message}
        <span className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1.5 rotate-45 border-b border-r border-slate-200 bg-white" />
      </p>

      <div className="relative pt-3" style={{ transform: `translateX(${shift}px)`, transition: "transform 0.4s ease-out" }}>
        {/* little glowing dots orbiting the mascot */}
        <div className={`mascot-orbit pointer-events-none absolute inset-0 ${excited ? "is-excited" : ""}`}>
          <span className="absolute left-0 top-1/3 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_3px_rgba(34,211,238,0.6)]" />
          <span className="absolute bottom-1/4 right-0 h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_8px_2px_rgba(94,234,212,0.6)]" />
          <span className="absolute right-1/4 top-0 h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgba(103,232,249,0.6)]" />
        </div>
        <div className={`mascot-float ${excited ? "is-excited" : ""}`}>
          <div className="mascot-wiggle">
            <Image src="/mascot.png" alt="" width={557} height={640} className={`mascot-glow h-auto w-full ${excited ? "is-excited" : ""}`} unoptimized />
          </div>
        </div>
        <div className="mascot-shadow mx-auto mt-1 h-2.5 w-24 rounded-full bg-slate-900/30 blur-sm" />
      </div>
    </div>
  );
}
