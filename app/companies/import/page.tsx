import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import CompanyImportClient from "@/components/company/CompanyImportClient";

export default function CompanyImportPage() {
  return <AppShell><PageHeader eyebrow="CRM" title="Import companies" subtitle="Upload a CSV and review new company records before saving." /><section className="p-6 lg:p-10"><CompanyImportClient /></section></AppShell>;
}

