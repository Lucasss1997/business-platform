import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CompanyCallingClient from "@/components/company/CompanyCallingClient";

export default function CompanyCallingPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CRM" title="Calling and ratings"
        subtitle="Record calls, qualify prospects and organise follow-ups." />
      <section className="p-6 lg:p-10"><CompanyCallingClient /></section>
    </AppShell>
  );
}