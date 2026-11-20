"use client";

import { useEffect, useState } from "react";
import Trovie, { type TrovieMood } from "./Trovie";

// Trovie on the login page. He watches the form: friendly while you type your email,
// and covers his eyes while you type your password.
export default function LoginTrovie() {
  const [mood, setMood] = useState<TrovieMood>("idle");
  useEffect(() => {
    const focus = (e: FocusEvent) => {
      const t = e.target as HTMLInputElement | null;
      if (!t || t.tagName !== "INPUT") return;
      setMood(t.name === "password" ? "private" : t.name === "email" ? "typing" : "idle");
    };
    const blur = () => setMood("idle");
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    return () => { document.removeEventListener("focusin", focus); document.removeEventListener("focusout", blur); };
  }, []);
  return <Trovie mood={mood} widthClass="w-36" />;
}
