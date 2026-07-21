import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CompanyForm from "@/components/CompanyForm";

export default function NewCompanyPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CRM" title="Add company" subtitle="Create a customer, prospect or lead record." />
      <section className="mx-auto max-w-6xl p-6 lg:p-10"><CompanyForm /></section>
    </AppShell>
  );
}
