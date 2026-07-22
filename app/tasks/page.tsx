import AppShell from "@/components/layout/AppShell";
import GlobalTaskList from "@/components/tasks/GlobalTaskList";
import PageHeader from "@/components/ui/PageHeader";

export default function TasksPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Workflow"
        title="Tasks"
        subtitle="View outstanding actions, deadlines and completed work across all companies."
      />

      <section className="p-6 lg:p-10">
        <GlobalTaskList />
      </section>
    </AppShell>
  );
}