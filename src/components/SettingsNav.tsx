"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsNav({ items }: { items: { href: string; label: string; hint: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((i) => {
        const active = pathname === i.href;
        return (
          <Link key={i.href} href={i.href} className={`block rounded-lg px-3 py-2 ${active ? "bg-accent-soft" : "hover:bg-slate-100"}`}>
            <span className={`block text-sm font-medium ${active ? "text-accent" : "text-slate-800"}`}>{i.label}</span>
            <span className="block text-xs text-slate-500">{i.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
