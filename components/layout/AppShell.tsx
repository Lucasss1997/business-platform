import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

type AppShellProps = { children: ReactNode };

export default function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[var(--surface-muted)] text-[var(--text-primary)]">
      <div className="min-h-screen lg:flex">
        <Sidebar />

        <div className="min-w-0 w-full flex-1">
          {children}
        </div>
      </div>
    </main>
  );
}