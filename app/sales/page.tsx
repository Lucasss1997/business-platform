import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import SalesPipelineClient from "@/components/sales/SalesPipelineClient";

export default function SalesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Sales"
        title="Sales pipeline"
        subtitle="View and manage opportunities across every company."
      />

      <section className="p-6 lg:p-10">
        <SalesPipelineClient />
      </section>
    </AppShell>
  );
}