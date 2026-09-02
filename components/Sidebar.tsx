"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/", symbol: "H" },
  { label: "Companies", href: "/companies", symbol: "C" },
  { label: "Sales", href: "/sales", symbol: "Â£" },
  { label: "Catalogue", href: "/catalogue", symbol: "K" },
  { label: "Tasks", href: "/tasks", symbol: "T" },
  { label: "Settings", href: "/settings", symbol: "S" },
];

const plannedItems = [
  "Contacts",
  "Documents",
  "Reports",
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/" && pathname.startsWith(href))
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-xl font-semibold text-[var(--text-primary)]"
        >
          ?
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101827] text-xs font-black text-white">
            P
          </div>

          <span className="text-sm font-bold text-[var(--text-primary)]">
            The Platform
          </span>
        </div>

        <div className="h-10 w-10" aria-hidden="true" />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          <aside className="relative z-10 flex h-full w-[82%] max-w-sm flex-col bg-[#101827] px-4 py-6 text-white shadow-2xl">
            <div className="flex items-start justify-between px-3">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-[#101827]">
                  P
                </div>

                <h1 className="mt-4 text-lg font-bold">
                  The Platform
                </h1>

                <p className="mt-1 text-xs text-slate-400">
                  Working title Â· v0.1
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl text-white"
              >
                Ã—
              </button>
            </div>

            <nav className="mt-8 space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-white text-[#101827]"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-bold"
                    >
                      {item.symbol}
                    </span>

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
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[#101827] px-4 py-6 text-white lg:flex">
        <div className="mb-8 px-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-[#101827]">
            P
          </div>

          <h1 className="mt-4 text-lg font-bold">
            The Platform
          </h1>

          <p className="mt-1 text-xs text-slate-400">
            Working title Â· v0.1
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);

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
    </>
  );
}
