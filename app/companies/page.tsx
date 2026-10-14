import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CompaniesClient from "@/components/company/CompaniesClient";

export default function CompaniesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CRM" title="Companies" subtitle="Manage customer accounts, prospects and commercial relationships across MLT Consultants, Fuel Save Group and OC Digital." actionLabel="Add company" actionHref="/companies/new" />
      <section className="p-6 lg:p-10">
        <div className="mb-5 flex flex-wrap justify-end gap-3">
          <Link href="/companies/calling" className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white">Calling and ratings</Link>
          <Link href="/companies/import" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] hover:border-[var(--accent)]">Import CSV</Link>
        </div>
        <CompaniesClient />
      </section>
    </AppShell>
  );
}

