"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";
import StatusBadge from "@/components/ui/StatusBadge";

const STATUS_OPTIONS = [
  "All",
  "Prospect",
  "Qualified",
  "Proposal Sent",
  "Customer",
  "Inactive",
];

function money(value: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function normalise(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
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
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("company_name", { ascending: true });

      if (!active) return;

      if (error) {
        setError(error.message);
        setCompanies([]);
      } else {
        setCompanies((data || []) as Company[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const trimmedQuery = query.trim();
  const normalisedQuery = normalise(query);

  const filtered = useMemo(() => {
    return companies.filter((company) => {
      const matchesStatus =
        status === "All" || company.status === status;

      const haystack = [
        company.company_name,
        company.contact_name,
        company.email,
        company.phone,
        company.division,
        company.industry,
        company.lead_source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!trimmedQuery ||
          haystack.includes(trimmedQuery.toLowerCase()))
      );
    });
  }, [companies, status, trimmedQuery]);

  const exactCompanyExists = useMemo(() => {
    if (!normalisedQuery) return false;

    return companies.some(
      (company) =>
        normalise(company.company_name) === normalisedQuery,
    );
  }, [companies, normalisedQuery]);

  const similarCompanies = useMemo(() => {
    if (!normalisedQuery || exactCompanyExists) return [];

    return companies
      .filter((company) => {
        const companyName = normalise(company.company_name);

        return (
          companyName.includes(normalisedQuery) ||
          normalisedQuery.includes(companyName)
        );
      })
      .slice(0, 3);
  }, [companies, normalisedQuery, exactCompanyExists]);

  const annualValue = companies.reduce(
    (sum, company) => sum + Number(company.annual_value || 0),
    0,
  );

  const activeCustomers = companies.filter(
    (company) => company.status === "Customer",
  ).length;

  const prospects = companies.filter(
    (company) => company.status === "Prospect",
  ).length;

  const createHref = trimmedQuery
    ? `/companies/new?companyName=${encodeURIComponent(trimmedQuery)}`
    : "/companies/new";

  function clearFilters() {
    setQuery("");
    setStatus("All");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total companies" value={String(companies.length)} />
        <Metric label="Active customers" value={String(activeCustomers)} />
        <Metric label="Prospects" value={String(prospects)} />
        <Metric
          label="Recorded annual value"
          value={money(annualValue)}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
              >
                ⌕
              </span>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search company, contact, division or industry..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-11 pr-11 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="flex gap-3">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="min-w-40 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 lg:flex-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>

              <Link
                href={createHref}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-95"
              >
                + Add company
              </Link>
            </div>
          </div>

          {!loading && !error ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Showing {filtered.length} of {companies.length} companies
              </p>

              {query || status !== "All" ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading ? (
          <StateMessage
            title="Loading companies..."
            text="Reading the latest CRM records from Supabase."
          />
        ) : error ? (
          <StateMessage
            title="Companies could not be loaded"
            text={error}
            error
          />
        ) : filtered.length === 0 ? (
          <div className="m-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-8 text-center sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-xl shadow-sm">
              🔎
            </div>

            <h3 className="mt-4 text-base font-bold text-[var(--text-primary)]">
              {companies.length
                ? "No matching companies"
                : "No companies added yet"}
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">
              {companies.length
                ? trimmedQuery
                  ? `We could not find a company matching “${trimmedQuery}”.`
                  : "No companies match the selected status."
                : "Create the first record to start building the CRM."}
            </p>

            {similarCompanies.length > 0 ? (
              <div className="mx-auto mt-5 max-w-lg rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-500">
                  Similar companies already exist
                </p>

                <div className="mt-3 space-y-2">
                  {similarCompanies.map((company) => (
                    <Link
                      key={company.id}
                      href={`/companies/${company.id}`}
                      className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--surface-soft)]"
                    >
                      <span>{company.company_name}</span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Open →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {trimmedQuery && !exactCompanyExists ? (
                <Link
                  href={createHref}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-95"
                >
                  + Create “{trimmedQuery}”
                </Link>
              ) : !companies.length ? (
                <Link
                  href="/companies/new"
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-95"
                >
                  + Add company
                </Link>
              ) : null}

              {query || status !== "All" ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-soft)]"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Division</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Primary contact</th>
                  <th className="px-5 py-3 text-right">Annual value</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((company) => (
                  <tr
                    key={company.id}
                    className="transition hover:bg-[var(--surface-soft)]"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-bold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                      >
                        {company.company_name}
                      </Link>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {company.industry || "Industry not recorded"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-[var(--text-secondary)]">
                      {company.division || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={company.status} />
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-[var(--text-primary)]">
                        {company.contact_name || "—"}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {company.email ||
                          company.phone ||
                          "No contact details"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-[var(--text-primary)]">
                      {money(company.annual_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--accent)]">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>

      <p className="mt-2 truncate text-2xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function StateMessage({
  title,
  text,
  error = false,
}: {
  title: string;
  text: string;
  error?: boolean;
}) {
  return (
    <div
      className={`m-5 rounded-xl border border-dashed p-10 text-center ${
        error
          ? "border-red-300/50 bg-red-500/10"
          : "border-[var(--border)] bg-[var(--surface-soft)]"
      }`}
    >
      <p
        className={`font-bold ${
          error ? "text-red-500" : "text-[var(--text-primary)]"
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-2 text-sm ${
          error ? "text-red-400" : "text-[var(--text-secondary)]"
        }`}
      >
        {text}
      </p>
    </div>
  );
}