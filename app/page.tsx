import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import DashboardClient from "@/components/DashboardClient";

export default function Home() {
  return <AppShell><PageHeader title="Business dashboard" subtitle="A clear view of the companies and commercial relationships that need your attention." actionLabel="Add company" actionHref="/companies/new" /><section className="p-6 lg:p-10"><DashboardClient /></section></AppShell>;
}
