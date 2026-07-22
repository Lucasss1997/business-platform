import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CatalogueClient from "@/components/catalogue/CatalogueClient";

export default function CataloguePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Commercial"
        title="Catalogue"
        subtitle="Manage the products, services, software, labour and recurring items used across proposals, purchasing and invoicing."
      />

      <section className="p-6 lg:p-10">
        <CatalogueClient />
      </section>
    </AppShell>
  );
}