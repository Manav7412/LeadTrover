"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV = [
  { href: "/welcome", label: "Home", icon: icon("M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10") },
  { href: "/dashboard", label: "Dashboard", icon: icon("M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z") },
  { href: "/contacts", label: "Contacts", icon: icon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8") },
  { href: "/pipelines", label: "Pipelines", icon: icon("M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z") },
  { href: "/tasks", label: "Tasks", icon: icon("M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9") },
  { href: "/calendar", label: "Calendar", icon: icon("M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z") },
  { href: "/reports", label: "Reports", icon: icon("M4 20V10M10 20V4M16 20v-7M22 20H2") },
  { href: "/templates", label: "Templates", icon: icon("M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6") },
  { href: "/forms", label: "Forms", icon: icon("M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5") },
  { href: "/settings", label: "Settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z") },
];

export default function Sidebar({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 flex w-56 flex-col bg-sidebar text-slate-300">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white">
          <Image src="/logo-icon.png" alt="" width={160} height={160} className="h-8 w-8 object-contain" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">LeadTrove</span>
      </div>
      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.filter((item) => !hidden.includes(item.href)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-sidebar-hover text-white" : "hover:bg-sidebar-hover/60 hover:text-white"
              }`}
            >
              <span className={active ? "text-teal-300" : "text-slate-400"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 py-4 text-xs text-slate-500">Demo data only</p>
    </aside>
  );
}
