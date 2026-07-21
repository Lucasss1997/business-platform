"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";
import StatusBadge from "@/components/ui/StatusBadge";

function money(value: number | null) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}

export default function CompaniesClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("companies").select("*").order("company_name", { ascending: true });
      if (!active) return;
      if (error) setError(error.message);
      else setCompanies((data || []) as Company[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesStatus = status === "All" || company.status === status;
      const haystack = [company.company_name, company.contact_name, company.email, company.division, company.industry].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [companies, query, status]);

  const annualValue = companies.reduce((sum, company) => sum + Number(company.annual_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total companies" value={String(companies.length)} />
        <Metric label="Active customers" value={String(companies.filter((item) => item.status === "Customer").length)} />
        <Metric label="Recorded annual value" value={money(annualValue)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, contact, division or industry..." className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm outline-none focus:border-slate-500 sm:max-w-md" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none">
            <option>All</option><option>Prospect</option><option>Qualified</option><option>Proposal Sent</option><option>Customer</option><option>Inactive</option>
          </select>
        </div>

        {loading ? <StateMessage title="Loading companies..." text="Reading the latest CRM records from Supabase." /> : error ? <StateMessage title="Companies could not be loaded" text={error} error /> : filtered.length === 0 ? <StateMessage title={companies.length ? "No matching companies" : "No companies added yet"} text={companies.length ? "Try a different search or status filter." : "Create the first record to start building the CRM."} action={!companies.length} /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Company</th><th className="px-5 py-3">Division</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Primary contact</th><th className="px-5 py-3 text-right">Annual value</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((company) => (
                  <tr key={company.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4"><Link href={`/companies/${company.id}`} className="font-bold text-slate-900 hover:underline">{company.company_name}</Link><p className="mt-1 text-xs text-slate-500">{company.industry || "Industry not recorded"}</p></td>
                    <td className="px-5 py-4 text-slate-600">{company.division || "—"}</td>
                    <td className="px-5 py-4"><StatusBadge status={company.status} /></td>
                    <td className="px-5 py-4"><p className="font-medium text-slate-800">{company.contact_name || "—"}</p><p className="mt-1 text-xs text-slate-500">{company.email || company.phone || "No contact details"}</p></td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-800">{money(company.annual_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"><p className="text-sm text-[var(--text-secondary)]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

function StateMessage({ title, text, error = false, action = false }: { title: string; text: string; error?: boolean; action?: boolean }) {
  return <div className={`m-5 rounded-xl border border-dashed p-10 text-center ${error ? "border-red-200 bg-red-50" : "border-[var(--border)] bg-slate-50"}`}><p className={`font-bold ${error ? "text-red-700" : "text-slate-900"}`}>{title}</p><p className={`mt-2 text-sm ${error ? "text-red-600" : "text-slate-500"}`}>{text}</p>{action ? <Link href="/companies/new" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Add company</Link> : null}</div>;
}
