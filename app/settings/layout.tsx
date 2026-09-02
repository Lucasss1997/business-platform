import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import SettingsNav from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Manage your organisation, branding, integrations and Platform configuration."
      />

      <div className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <SettingsNav />

          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
