"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildCompanyPayload, normaliseCompanyName } from "@/modules/companies";
import { createCompanyRecord } from "@/modules/companies/repository";
import { emitEvent } from "@/platform/events";
import { csvColumns, readCompanyCsv, type CsvRow } from "@/lib/companyCsv";

type PreviewRow = CsvRow & { duplicate: string; outcome: string };

async function existingNames(): Promise<Set<string>> {
  const names = new Set<string>();
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from("companies").select("id, company_name").order("id").range(start, start + 999);
    if (error) throw new Error(error.message);
    for (const company of data ?? []) names.add(normaliseCompanyName(company.company_name));
    if (!data || data.length < 1000) return names;
  }
}

export default function CompanyImportClient() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const lock = useRef(false);
  const ready = rows.filter(row => !row.errors.length && !row.duplicate && !row.outcome);
  const inputClass = "rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-primary)]";
  const buttonClass = "rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed";

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + csvColumns.join(",") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "company-import-template.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function preview(file: File | undefined) {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setRows([]); setError(""); setMessage(""); setFinished(false); setFilename(file.name);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Use a CSV file smaller than 5 MB.");
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const parsed = readCompanyCsv(decoded);
      const names = await existingNames();
      const seen = new Set<string>();
      setRows(parsed.map(row => {
        const key = normaliseCompanyName(row.values.company_name);
        const duplicate = names.has(key) ? "Already in the platform" : seen.has(key) ? "Repeated in this CSV" : "";
        if (!row.errors.length) seen.add(key);
        return { ...row, duplicate, outcome: "" };
      }));
    } catch (err) { setError(err instanceof Error ? err.message : "The CSV could not be read."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function importRows() {
    if (lock.current || finished || !ready.length) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    const updated = rows.map(row => ({ ...row }));
    let imported = 0, warnings = 0;
    try {
      const names = await existingNames();
      for (let i = 0; i < updated.length; i++) {
        const row = updated[i];
        if (row.errors.length || row.duplicate || row.outcome) continue;
        const key = normaliseCompanyName(row.values.company_name);
        if (names.has(key)) { row.duplicate = "Already in the platform"; setRows([...updated]); continue; }
        const payload = buildCompanyPayload(row.values);
        let id: string;
        try { id = await createCompanyRecord(payload); }
        catch (err) {
          row.outcome = "Save not confirmed - check company list before retrying";
          setRows([...updated]);
          throw new Error(`Stopped at ${payload.company_name}: ${err instanceof Error ? err.message : "Save failed"}. ${imported} company records saved before this row. Check the company list before uploading again.`);
        }
        names.add(key); imported++; row.outcome = "Imported";
        setRows([...updated]);
        try {
          await emitEvent({ companyId: id, entityType: "company", entityId: id, action: "created", description: `${payload.company_name} was created by CSV import`, actorName: "CSV import", metadata: { company_name: payload.company_name, status: payload.status, annual_value: payload.annual_value } });
        } catch {
          warnings++; row.outcome = "Imported - activity log failed";
        }
        setRows([...updated]);
      }
      setMessage(`${imported} companies imported. ${updated.filter(row => row.duplicate).length} duplicates skipped. ${updated.filter(row => row.errors.length).length} invalid rows skipped.${warnings ? ` ${warnings} activity logs failed; their company records were saved.` : ""}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Import stopped. Check the company list before retrying."); }
    finally { setFinished(true); lock.current = false; setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Link href="/companies" className="text-sm font-semibold text-[var(--accent)]">Back to companies</Link>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Upload companies</h2>
        <p className="text-sm text-[var(--text-secondary)]">Choose a CSV, review it, then import the valid new companies. Existing records are preserved. Matching company names are skipped.</p>
        <p className="text-sm text-[var(--text-secondary)]">Blank division, status and industry default to Fuel Save Group, Prospect and Construction. Keep phone numbers as text when editing in Excel. Save as CSV UTF-8 (comma delimited). Put locations, source links and BESS evidence in notes.</p>
        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" className={inputClass} onClick={downloadTemplate}>Download CSV template</button>
          <label className={inputClass}>Choose CSV <input type="file" accept=".csv,text/csv" disabled={busy} className="ml-3 max-w-full" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void preview(file); }} /></label>
        </div>
        {filename ? <p className="text-sm text-[var(--text-secondary)]">File: {filename}</p> : null}
        {busy ? <p role="status" className="text-sm text-[var(--text-secondary)]">{rows.length ? "Importing companies. Keep this page open." : "Reading CSV and checking existing companies..."}</p> : null}
      </section>
      {error ? <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-[var(--text-primary)]">{error}</div> : null}
      {message ? <div role="status" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-primary)]">{message} <Link className="font-bold text-[var(--accent)]" href="/companies">View companies</Link></div> : null}
      {rows.length ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">{rows.length} rows. {ready.length} ready. {rows.filter(row => row.duplicate).length} duplicates. {rows.filter(row => row.errors.length).length} invalid.</p>
          <button type="button" className={buttonClass} disabled={busy || finished || !ready.length} onClick={() => void importRows()}>{busy ? "Importing..." : finished ? "Import finished" : `Import ${ready.length} valid new companies`}</button>
        </div>
        <div className="overflow-auto max-h-[65vh]"><table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-soft)] text-[var(--text-secondary)]"><tr>{["Row", "Company", "Phone", "Email", "Division", "Status", "Result"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{rows.map(row => <tr key={row.row} className="text-[var(--text-primary)]">
            <td className="px-4 py-3">{row.row}</td><td className="px-4 py-3 font-semibold">{row.values.company_name}</td><td className="px-4 py-3 whitespace-nowrap">{row.values.phone}</td><td className="px-4 py-3">{row.values.email}</td><td className="px-4 py-3">{row.values.division}</td><td className="px-4 py-3">{row.values.status}</td><td className="px-4 py-3 min-w-64">{row.errors.join(" ") || row.duplicate || row.outcome || "Ready"}</td>
          </tr>)}</tbody>
        </table></div>
      </section> : null}
    </div>
  );
}

