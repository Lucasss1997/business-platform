"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CompanyDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id).single();
      if (error) setError(error.message); else setCompany(data as Company);
      setLoading(false);
    }
    load();
  }, [id]);

  async function remove() {
    if (!company || !window.confirm(`Delete ${company.company_name}? This cannot be undone.`)) return;
    setDeleting(true);
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) { setError(error.message); setDeleting(false); return; }
    router.push("/companies"); router.refresh();
  }

  if (loading) return <Panel>Loading company...</Panel>;
  if (error || !company) return <Panel>{error || "Company not found."}</Panel>;

  const website = company.website && !company.website.startsWith("http") ? `https://${company.website}` : company.website;
  const value = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(company.annual_value || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{company.company_name}</h2><StatusBadge status={company.status} /></div><p className="mt-2 text-sm text-slate-500">{company.industry || "Industry not recorded"} · {company.division || "No division selected"}</p></div>
        <div className="flex gap-2"><Link href={`/companies/${id}/edit`} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold hover:bg-slate-50">Edit</Link><button onClick={remove} disabled={deleting} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{deleting ? "Deleting..." : "Delete"}</button></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"><h3 className="text-lg font-bold">Company information</h3><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Website" value={website ? <a className="text-blue-700 hover:underline" href={website} target="_blank" rel="noreferrer">{company.website}</a> : "—"} /><Field label="Phone" value={company.phone || "—"} /><Field label="Lead source" value={company.lead_source || "—"} /><Field label="Annual value" value={value} /></dl></section>
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"><h3 className="text-lg font-bold">Primary contact</h3><dl className="mt-5 space-y-5"><Field label="Name" value={company.contact_name || "—"} /><Field label="Email" value={company.email ? <a className="text-blue-700 hover:underline" href={`mailto:${company.email}`}>{company.email}</a> : "—"} /><Field label="Mobile" value={company.mobile || "—"} /></dl></section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"><h3 className="text-lg font-bold">Notes</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{company.notes || "No notes have been added."}</p></section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd></div>; }
function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-[var(--border)] bg-white p-10 text-center text-sm text-slate-600 shadow-sm">{children}</div>; }
