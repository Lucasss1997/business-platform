import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import HelpGuides from "@/components/help/HelpGuides";
export default function HelpPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Team knowledge"
        title="Help & guides"
        subtitle="Find instructions, read team guides and download the latest PDFs."
      />
      <section className="p-6 lg:p-10">
        <HelpGuides />
      </section>
    </AppShell>
  );
}
