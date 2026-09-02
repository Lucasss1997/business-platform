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
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        setError(error.message);
      } else {
        setCompanies((data || []) as Company[]);
      }

      setLoading(false);
    }

    load();
  }, []);

  const annualValue = companies.reduce(
    (total, item) => total + Number(item.annual_value || 0),
    0
  );

  const currency = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-7">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Recent companies"
          value={loading ? "—" : String(companies.length)}
          note="Latest records loaded"
        />

        <MetricCard
          label="Customers"
          value={
            loading
              ? "—"
              : String(
                  companies.filter((item) => item.status === "Customer").length
                )
          }
          note="Active customer records"
        />

        <MetricCard
          label="Prospects"
          value={
            loading
              ? "—"
              : String(
                  companies.filter((item) => item.status === "Prospect").length
                )
          }
          note="Early-stage relationships"
        />

        <MetricCard
          label="Recorded value"
          value={loading ? "—" : currency.format(annualValue)}
          note="Across the latest records"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Recent companies
              </h2>

              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                The latest CRM records added to the platform.
              </p>
            </div>

            <Link
              href="/companies"
              className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent)]"
            >
              View all
            </Link>
          </div>

          {error ? (
            <div className="p-8 text-sm text-red-500">{error}</div>
          ) : loading ? (
            <div className="p-8 text-sm text-[var(--text-secondary)]">
              Loading dashboard...
            </div>
          ) : companies.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-bold text-[var(--text-primary)]">
                No activity yet
              </p>

              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Add the first company to bring the dashboard to life.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-[var(--surface-soft)]"
                >
                  <div>
                    <p className="font-bold text-[var(--text-primary)]">
                      {company.company_name}
                    </p>

                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {company.division || "No division"}
                    </p>
                  </div>

                  <StatusBadge status={company.status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Quick actions
          </h2>

          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Start with the core CRM workflow.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/companies/new"
              className="flex w-full items-center justify-between rounded-xl bg-[var(--button-primary)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--button-primary-hover)]"
            >
              Add company <span>→</span>
            </Link>

            <Link
              href="/companies"
              className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-soft)]"
            >
              Search companies <span>→</span>
            </Link>
          </div>

          <div className="mt-7 rounded-xl bg-[var(--surface-soft)] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              v0.1 focus
            </p>

            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              A reliable company database first. Contacts, tasks and sales will
              follow on the same foundation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--accent)]">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
        {value}
      </p>

      <p className="mt-2 text-xs text-[var(--text-secondary)]">{note}</p>
    </div>
  );
}