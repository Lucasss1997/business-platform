"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/", symbol: "⌂" },
  { label: "Companies", href: "/companies", symbol: "◇" },
  { label: "Sales", href: "/sales", symbol: "£" },
  { label: "Catalogue", href: "/catalogue", symbol: "▦" },
  { label: "Tasks", href: "/tasks", symbol: "✓" },
  { label: "Settings", href: "/settings", symbol: "S" },
];

const plannedItems = [
  "Contacts",
  "Documents",
  "Reports",
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[#101827] px-4 py-6 text-white lg:flex">
      <div className="mb-8 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-[#101827]">
          P
        </div>

        <h1 className="mt-4 text-lg font-bold">
          The Platform
        </h1>

        <p className="mt-1 text-xs text-slate-400">
          Working title · v0.1
        </p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-white text-[#101827]"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span aria-hidden>{item.symbol}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-white/10 pt-6">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
          Coming next
        </p>

        <div className="mt-3 space-y-1">
          {plannedItems.map((item) => (
            <div
              key={item}
              className="rounded-xl px-3 py-2 text-sm text-slate-500"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}




