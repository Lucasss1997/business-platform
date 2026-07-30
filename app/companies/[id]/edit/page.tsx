import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import EditCompanyClient from "@/components/company/EditCompanyClient";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><PageHeader eyebrow="CRM" title="Edit company" subtitle="Update the company, contact and commercial information." /><section className="mx-auto max-w-6xl p-6 lg:p-10"><EditCompanyClient id={id} /></section></AppShell>;
}
