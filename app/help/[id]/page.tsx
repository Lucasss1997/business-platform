import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import HelpGuides from "@/components/help/HelpGuides";
export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <PageHeader
        eyebrow="Team knowledge"
        title="Help & guides"
        subtitle="Practical instructions for your team."
      />
      <section className="p-6 lg:p-10">
        <HelpGuides guideId={id} />
      </section>
    </AppShell>
  );
}
