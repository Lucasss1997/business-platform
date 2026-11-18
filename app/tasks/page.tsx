import AppShell from "@/components/layout/AppShell";
import CallingWorkspace from "@/components/tasks/CallingWorkspace";
import PageHeader from "@/components/ui/PageHeader";

export default function TasksPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Workflow"
        title="Tasks"
        subtitle="Claim calls, record outcomes, schedule callbacks and follow up qualified leads."
      />

      <section className="p-6 lg:p-10">
        <CallingWorkspace />
      </section>
    </AppShell>
  );
}
