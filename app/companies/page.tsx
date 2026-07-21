import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CompaniesClient from "@/components/company/CompaniesClient";

export default function CompaniesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CRM" title="Companies" subtitle="Manage customer accounts, prospects and commercial relationships across MLT Consultants, Fuel Save Group and OC Digital." actionLabel="Add company" actionHref="/companies/new" />
      <section className="p-6 lg:p-10"><CompaniesClient /></section>
    </AppShell>
  );
}
