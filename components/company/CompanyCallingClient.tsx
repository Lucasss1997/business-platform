"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";

type CallingCompany = Company & {
  prospect_rating: number | null;
  call_outcome: string | null;
  caller_name: string | null;
  call_notes: string | null;
  follow_up_date: string | null;
  calling_version: number;
};

const outcomes = [
  "Not called", "No answer", "Voicemail", "Spoke to contact",
  "Callback requested", "Interested", "Not interested", "Wrong number",
];
const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text-primary)]";

export default function CompanyCallingClient() {
  const [companies, setCompanies] = useState<CallingCompany[]>([]);
  const [selected, setSelected] = useState<CallingCompany | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const records: CallingCompany[] = [];
        for (let start = 0; ; start += 1000) {
          const result = await supabase.from("companies")
            .select("*").order("id").range(start, start + 999);
          if (result.error) throw new Error(result.error.message);
          records.push(...(result.data ?? []) as CallingCompany[]);
          if (!result.data || result.data.length < 1000) break;
        }
        if (active) setCompanies(records.sort((a, b) =>
          a.company_name.localeCompare(b.company_name)));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Loading failed.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      prospect_rating: form.get("rating") ? Number(form.get("rating")) : null,
      call_outcome: String(form.get("outcome")),
      caller_name: String(form.get("caller") || "").trim() || null,
      call_notes: String(form.get("notes") || "").trim() || null,
      follow_up_date: String(form.get("followup") || "") || null,
      calling_version: selected.calling_version + 1,
    };
    try {
      const result = await supabase.from("companies").update(payload)
        .eq("id", selected.id)
        .eq("calling_version", selected.calling_version)
        .select("*");
      if (result.error) throw new Error(result.error.message);
      if (!result.data?.length) {
        throw new Error("Save was not applied. The record may have changed or your account may lack access. Copy your notes before refreshing.");
      }
      const saved = result.data[0] as CallingCompany;
      setCompanies(previous => previous.map(company =>
        String(company.id) === String(saved.id) ? saved : company));
      setSelected(saved);
      setMessage("Calling details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  const visible = companies.filter(company => {
    const matches = [company.company_name, company.contact_name,
      company.industry, company.division, company.caller_name]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return matches && (
      filter === "All" ||
      (filter === "Unrated" && !company.prospect_rating) ||
      (filter === "Strong prospects" && (company.prospect_rating ?? 0) >= 4) ||
      (filter === "Not called" && (!company.call_outcome || company.call_outcome === "Not called"))
    );
  });

  return <div className="space-y-5">
    <Link href="/companies" className="text-[var(--accent)]">Back to companies</Link>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-[var(--text-primary)]">{error}</p>}
    {message && <p role="status" className="text-[var(--accent)]">{message}</p>}
    {loading ? <p>Loading companies...</p> : <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <input aria-label="Search companies" className={field} placeholder="Search companies or callers..."
          value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Filter companies" className={field} value={filter}
          onChange={event => setFilter(event.target.value)}>
          {["All", "Not called", "Unrated", "Strong prospects"].map(value =>
            <option key={value}>{value}</option>)}
        </select>
        <p className="text-sm text-[var(--text-secondary)]">{visible.length} companies</p>
        <div className="max-h-[65vh] overflow-auto space-y-2">
          {visible.map(company => <button key={company.id} disabled={busy}
            className={`${field} text-left disabled:opacity-50`}
            onClick={() => {
              if (selected && !window.confirm("Open this company? Unsaved edits will be discarded.")) return;
              setSelected(company); setMessage(""); setError("");
            }}>
            <span className="font-bold">{company.company_name}</span>
            <span className="mt-1 block text-sm">
              {company.prospect_rating ? `${company.prospect_rating}/5` : "Unrated"}
              {" · "}{company.call_outcome || "Not called"}
              {company.follow_up_date && ` · Follow-up ${company.follow_up_date}`}
            </span>
          </button>)}
        </div>
      </section>
      {selected ? <form key={`${selected.id}-${selected.calling_version}`} onSubmit={save}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{selected.company_name}</h2>
        <p className="text-[var(--text-secondary)]">{selected.contact_name || "No contact recorded"}</p>
        <div className="flex flex-wrap gap-4 text-[var(--accent)]">
          {(selected.phone || selected.mobile) && <a href={`tel:${selected.phone || selected.mobile}`}>{selected.phone || selected.mobile}</a>}
          {selected.email && <a href={`mailto:${selected.email}`}>{selected.email}</a>}
          <Link href={`/companies/${selected.id}`}>Company profile</Link>
        </div>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block">Prospect rating
            <select name="rating" className={field} defaultValue={selected.prospect_rating ?? ""}>
              <option value="">Unrated</option>
              <option value="1">1 - Poor fit</option>
              <option value="2">2 - Low potential</option>
              <option value="3">3 - Worth following up</option>
              <option value="4">4 - Strong prospect</option>
              <option value="5">5 - High priority</option>
            </select>
          </label>
          <label className="block">Call outcome
            <select name="outcome" className={field} defaultValue={selected.call_outcome || "Not called"}>
              {[...new Set([...outcomes, selected.call_outcome].filter(Boolean))].map(value =>
                <option key={value!}>{value}</option>)}
            </select>
          </label>
          <label className="block">Caller / assigned salesperson
            <input name="caller" className={field} defaultValue={selected.caller_name || ""} />
          </label>
          <label className="block">Follow-up date
            <input name="followup" type="date" className={field} defaultValue={selected.follow_up_date || ""} />
          </label>
          <label className="block">Calling notes
            <textarea name="notes" rows={6} className={field} defaultValue={selected.call_notes || ""} />
          </label>
          <button className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white">
            {busy ? "Saving..." : "Save calling details"}
          </button>
        </fieldset>
      </form> : <p className="text-[var(--text-secondary)]">Select a company to record a call.</p>}
    </div>}
  </div>;
}