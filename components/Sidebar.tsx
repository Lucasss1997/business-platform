"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const groups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/", icon: "dashboard" },
      { label: "Tasks", href: "/tasks", icon: "tasks" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Companies", href: "/companies", icon: "companies" },
      { label: "Calling and ratings", href: "/companies/calling", icon: "phone" },
      { label: "Sales pipeline", href: "/sales", icon: "sales" },
    ],
  },
  {
    label: "Products and content",
    items: [
      { label: "Catalogue", href: "/catalogue", icon: "catalogue" },
      { label: "Marketing", href: "/marketing", icon: "marketing" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Settings", href: "/settings", icon: "settings" },
    ],
  },
];

const paths: Record<string, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  tasks: "M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2",
  companies: "M4 21V5h10v16 M14 10h6v11 M2 21h20 M7 8h4 M7 12h4 M7 16h4 M17 13h1 M17 17h1",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z",
  sales: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  catalogue: "M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5",
  marketing: "M3 10v4h4l11 5V5L7 10z M7 14l2 7h4l-2-5 M21 9v6",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  arrow: "M5 12h14 M13 6l6 6-6 6",
};

function Icon({ name }: { name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
    strokeLinejoin="round" className="h-5 w-5 shrink-0">
    <path d={paths[name] || paths.dashboard} />
  </svg>;
}

export default function Sidebar() {
  const pathname = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);

  const allItems = groups.flatMap(group => group.items);
  const activeHref = allItems
    .filter(item => item.href === "/" ? pathname === "/" :
      pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  function closeMenu() {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }

  function navigation() {
    return <nav aria-label="Main navigation" className="space-y-7">
      {groups.map(group => <div key={group.label}>
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {group.label}
        </p>
        <div className="space-y-1">
          {group.items.map(item => {
            const active = activeHref === item.href;
            return <Link key={item.href} href={item.href}
              onClick={closeMenu} aria-current={active ? "page" : undefined}
              className={`group flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                active
                  ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}>
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-300" />}
            </Link>;
          })}
        </div>
      </div>)}
    </nav>;
  }

  function brand() {
    return <Link href="/" onClick={closeMenu}
      className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-400">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-300 to-emerald-500 text-lg font-black text-slate-950 shadow-lg shadow-emerald-950/30">
        P
      </span>
      <span>
        <span className="block text-base font-semibold tracking-tight text-white">The Platform</span>
        <span className="mt-0.5 block text-[11px] text-slate-400">Business workspace</span>
      </span>
    </Link>;
  }

  return <>
    <details key={pathname} ref={mobileMenu}
      onKeyDown={event => {
        if (event.key === "Escape") {
          closeMenu();
          mobileMenu.current?.querySelector("summary")?.focus();
        }
      }}
      className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1728] text-white lg:hidden">
      <summary aria-label="Toggle navigation"
        className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 focus-visible:outline-2 focus-visible:outline-emerald-400 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 font-black text-slate-950">P</span>
          <span className="text-sm font-semibold">The Platform</span>
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs">
          <Icon name="menu" /> Menu
        </span>
      </summary>
      <div className="max-h-[calc(100dvh-80px)] overflow-y-auto border-t border-white/10 p-5">
        {navigation()}
      </div>
    </details>

    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-white/5 bg-[#0d1728] text-white lg:flex">
      <div className="px-6 pb-7 pt-8">{brand()}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{navigation()}</div>
      <div className="border-t border-white/10 p-4">
        <Link href="/companies/calling"
          className="flex items-center gap-3 rounded-xl bg-white/5 p-4 text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-emerald-400">
          <span className="text-emerald-300"><Icon name="phone" /></span>
          <span className="flex-1">
            <span className="block font-semibold">Start calling</span>
            <span className="mt-1 block text-xs text-slate-400">Build your next opportunity</span>
          </span>
          <Icon name="arrow" />
        </Link>
      </div>
    </aside>
  </>;
}