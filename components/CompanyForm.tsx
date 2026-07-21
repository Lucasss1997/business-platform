"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { companyStatuses, divisions, type CompanyFormValues } from "@/lib/types/company";

const industries = ["Construction", "Manufacturing", "Logistics", "Retail", "Healthcare", "Education", "Hospitality", "Managed Print", "Energy", "Telecoms", "Professional Services", "Other"];

const emptyValues: CompanyFormValues = {
  company_name: "",
  website: "",
  phone: "",
  industry: "",
  contact_name: "",
  email: "",
  mobile: "",
  division: "",
  status: "Prospect",
  lead_source: "",
  annual_value: null,
  notes: "",
};

export default function CompanyForm({ companyId, initialValues }: { companyId?: string; initialValues?: Partial<CompanyFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyFormValues>({ ...emptyValues, ...initialValues });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (name: keyof CompanyFormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: name === "annual_value" ? (value === "" ? null : Number(value)) : value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...values,
      company_name: values.company_name.trim(),
      website: values.website?.trim() || null,
      phone: values.phone?.trim() || null,
      industry: values.industry || null,
      contact_name: values.contact_name?.trim() || null,
      email: values.email?.trim() || null,
      mobile: values.mobile?.trim() || null,
      division: values.division || null,
      status: values.status || "Prospect",
      lead_source: values.lead_source?.trim() || null,
      annual_value: values.annual_value || 0,
      notes: values.notes?.trim() || null,
    };

    const result = companyId
      ? await supabase.from("companies").update(payload).eq("id", companyId)
      : await supabase.from("companies").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    router.push(companyId ? `/companies/${companyId}` : "/companies");
    router.refresh();
  }

  const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
  const labelClass = "text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={submit} className="space-y-8">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Company details</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className={labelClass}>Company name *<input required className={inputClass} value={values.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Enter company name" /></label>
          <label className={labelClass}>Website<input className={inputClass} value={values.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="https://example.co.uk" /></label>
          <label className={labelClass}>Phone<input className={inputClass} value={values.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="Main office number" /></label>
          <label className={labelClass}>Industry<select className={inputClass} value={values.industry || ""} onChange={(e) => update("industry", e.target.value)}><option value="">Select industry</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Primary contact</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">We can move this into a full contacts module in v0.2.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <label className={labelClass}>Contact name<input className={inputClass} value={values.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} placeholder="Full name" /></label>
          <label className={labelClass}>Email<input type="email" className={inputClass} value={values.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="name@company.co.uk" /></label>
          <label className={labelClass}>Mobile<input className={inputClass} value={values.mobile || ""} onChange={(e) => update("mobile", e.target.value)} placeholder="Mobile number" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Commercial information</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>Division<select className={inputClass} value={values.division || ""} onChange={(e) => update("division", e.target.value)}><option value="">Select division</option>{divisions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={labelClass}>Status<select className={inputClass} value={values.status || "Prospect"} onChange={(e) => update("status", e.target.value)}>{companyStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={labelClass}>Lead source<input className={inputClass} value={values.lead_source || ""} onChange={(e) => update("lead_source", e.target.value)} placeholder="Referral, website, outbound..." /></label>
          <label className={labelClass}>Annual value (£)<input min="0" step="0.01" type="number" className={inputClass} value={values.annual_value ?? ""} onChange={(e) => update("annual_value", e.target.value)} placeholder="0" /></label>
        </div>
        <label className={`${labelClass} mt-5 block`}>Notes<textarea rows={5} className={inputClass} value={values.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="Useful background, current requirements and next steps" /></label>
      </section>

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-[var(--text-primary)] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : companyId ? "Save changes" : "Create company"}</button>
      </div>
    </form>
  );
}
