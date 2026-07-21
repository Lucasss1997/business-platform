"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";
import StatusBadge from "@/components/ui/StatusBadge";

export default function DashboardClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false }).limit(6);
      if (error) setError(error.message); else setCompanies((data || []) as Company[]);
      setLoading(false);
    }
    load();
  }, []);

  const annualValue = companies.reduce((total, item) => total + Number(item.annual_value || 0), 0);
  const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  return (
    <div className="space-y-7">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Recent companies" value={loading ? "—" : String(companies.length)} note="Latest records loaded" />
        <Card label="Customers" value={loading ? "—" : String(companies.filter((item) => item.status === "Customer").length)} note="Active customer records" />
        <Card label="Prospects" value={loading ? "—" : String(companies.filter((item) => item.status === "Prospect").length)} note="Early-stage relationships" />
        <Card label="Recorded value" value={loading ? "—" : currency.format(annualValue)} note="Across the latest records" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5"><div><h2 className="text-lg font-bold">Recent companies</h2><p className="mt-1 text-sm text-slate-500">The latest CRM records added to the platform.</p></div><Link href="/companies" className="text-sm font-bold text-slate-700 hover:underline">View all</Link></div>
          {error ? <div className="p-8 text-sm text-red-700">{error}</div> : loading ? <div className="p-8 text-sm text-slate-500">Loading dashboard...</div> : companies.length === 0 ? <div className="p-10 text-center"><p className="font-bold">No activity yet</p><p className="mt-2 text-sm text-slate-500">Add the first company to bring the dashboard to life.</p></div> : <div className="divide-y divide-[var(--border)]">{companies.map((company) => <Link key={company.id} href={`/companies/${company.id}`} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50"><div><p className="font-bold text-slate-900">{company.company_name}</p><p className="mt-1 text-xs text-slate-500">{company.division || "No division"}</p></div><StatusBadge status={company.status} /></Link>)}</div>}
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Quick actions</h2><p className="mt-1 text-sm text-slate-500">Start with the core CRM workflow.</p><div className="mt-5 space-y-3"><Link href="/companies/new" className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Add company <span>→</span></Link><Link href="/companies" className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Search companies <span>→</span></Link></div><div className="mt-7 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">v0.1 focus</p><p className="mt-2 text-sm leading-6 text-slate-600">A reliable company database first. Contacts, tasks and sales will follow on the same foundation.</p></div></aside>
      </div>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></div>; }
