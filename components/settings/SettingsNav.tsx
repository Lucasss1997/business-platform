"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    label: "Overview",
    href: "/settings",
    description: "Settings overview",
  },
  {
    label: "Organisation",
    href: "/settings/organisation",
    description: "Business details and branding",
  },
  {
    label: "Business details",
    href: "/settings/organisation/business-details",
    description: "Legal and company information",
  },
  {
    label: "Branding",
    href: "/settings/organisation/branding",
    description: "Logo and customer-facing identity",
  },
  {
    label: "Users & access",
    href: "/settings/users",
    description: "Invite users and manage access",
  },
  {
    label: "Integrations",
    href: "/settings/integrations",
    description: "Connected services",
  },
  {
    label: "Microsoft 365",
    href: "/settings/integrations/microsoft",
    description: "Email integration",
  },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full lg:w-64 lg:shrink-0">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <nav className="space-y-1">
          {sections.map((section) => {
            const active =
              section.href === "/settings"
                ? pathname === "/settings"
                : pathname === section.href;

            return (
              <Link
                key={section.href}
                href={section.href}
                className={`block rounded-xl px-3 py-3 transition ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <div className="text-sm font-semibold">
                  {section.label}
                </div>

                <div
                  className={`mt-0.5 text-xs ${
                    active
                      ? "text-white/75"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {section.description}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
