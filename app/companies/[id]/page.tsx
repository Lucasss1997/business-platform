import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CompanyDetailClient from "@/components/company/CompanyDetailClient";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <PageHeader
        eyebrow="CRM"
        title="Company record"
        subtitle="View the commercial and contact information held for this company."
      />
      <section className="p-6 lg:p-10">
        <CompanyDetailClient id={id} />
      </section>
    </AppShell>
  );
}