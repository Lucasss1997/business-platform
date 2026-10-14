import { companyStatuses, divisions, type CompanyFormValues } from "@/lib/types/company";

export const csvColumns = ["company_name", "website", "phone", "industry", "contact_name", "email", "mobile", "division", "status", "lead_source", "annual_value", "notes"] as const;
export type CsvRow = { row: number; values: CompanyFormValues; errors: string[] };

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const pushField = () => { row.push(field); field = ""; closed = false; };
  const pushRow = () => { pushField(); if (row.some(value => value.trim())) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
      continue;
    }
    if (char === ",") { pushField(); continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      pushRow(); continue;
    }
    if (closed) {
      if (char === " " || char === "\t") continue;
      throw new Error("Unexpected text after a quoted CSV field.");
    }
    if (char === '"') {
      if (field.length) throw new Error("Quotes inside a field must be escaped and the field quoted.");
      quoted = true;
    } else field += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  pushRow();
  return rows;
}

export function readCompanyCsv(text: string): CsvRow[] {
  const [header, ...records] = parseCsv(text);
  if (!header || !records.length) throw new Error("Add a header and at least one company row.");
  if (records.length > 1000) throw new Error("Import up to 1,000 companies per file.");
  const headers = header.map(value => value.trim().toLowerCase());
  if (!headers.includes("company_name")) throw new Error("Missing company_name column. Use the downloadable template.");
  if (new Set(headers).size !== headers.length) throw new Error("The CSV contains duplicate column headers.");
  const unknown = headers.filter(key => !(csvColumns as readonly string[]).includes(key));
  if (unknown.length) throw new Error(`Unrecognised columns: ${unknown.join(", ")}. Put location, sources and BESS evidence in notes.`);
  return records.map((record, index) => {
    const errors: string[] = [];
    if (record.length !== headers.length) errors.push("Column count does not match the header.");
    const data: Record<string, string> = {};
    headers.forEach((key, i) => { data[key] = (record[i] ?? "").trim(); });
    const annualText = data.annual_value || "";
    const annual = annualText === "" ? null : Number(annualText);
    const canonical = (value: string, choices: readonly string[]) => choices.find(item => item.toLowerCase() === value.toLowerCase()) || value;
    const values: CompanyFormValues = {
      company_name: data.company_name || "", website: data.website || "", phone: data.phone || "",
      industry: data.industry || "Construction", contact_name: data.contact_name || "", email: data.email || "",
      mobile: data.mobile || "", division: canonical(data.division || "Fuel Save Group", divisions),
      status: canonical(data.status || "Prospect", companyStatuses), lead_source: data.lead_source || "CSV import",
      annual_value: annual, notes: data.notes || "",
    };
    if (!/[a-z0-9]/i.test(values.company_name)) errors.push("Company name is required and must contain letters or numbers.");
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push("Email address is invalid.");
    if (annual !== null && (!Number.isFinite(annual) || annual < 0 || !/^\d+(\.\d+)?$/.test(annualText))) errors.push("Annual value must be a positive number or zero, without currency signs or thousands separators.");
    if (!(divisions as readonly string[]).includes(values.division || "")) errors.push("Division is not recognised.");
    if (!(companyStatuses as readonly string[]).includes(values.status || "")) errors.push("Status is not recognised.");
    if (values.website) {
      try { const url = new URL(/^https?:\/\//i.test(values.website) ? values.website : `https://${values.website}`); if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) throw new Error(); }
      catch { errors.push("Website must be a valid HTTP or HTTPS address."); }
    }
    return { row: index + 2, values, errors };
  });
}

