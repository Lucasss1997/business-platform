"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactList from "@/components/contact/ContactList";
import OpportunityList from "@/components/sales/OpportunityList";

type Tab =
  | "overview"
  | "people"
  | "sales"
  | "tasks"
  | "activity"
  | "documents";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "sales", label: "Sales" },
  { id: "tasks", label: "Tasks" },
  { id: "activity", label: "Activity" },
  { id: "documents", label: "Documents" },
];

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function CompanyDetailClient({ id }: { id: string }) {
  const router = useRouter();

  const [company, setCompany] = useState<Company | null>(null);
  const [contactCount, setContactCount] = useState(0);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const [companyResult, contactsResult] = await Promise.all([
        supabase.from("companies").select("*").eq("id", id).single(),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", id),
      ]);

      if (!active) return;

      if (companyResult.error) {
        setError(companyResult.error.message);
        setCompany(null);
      } else {
        setCompany(companyResult.data as Company);
        setContactCount(contactsResult.count || 0);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

  async function remove() {
    if (!company) return;

    const confirmed = window.confirm(
      `Delete ${company.company_name}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      setDeleting(false);
      return;
    }

    router.push("/companies");
    router.refresh();
  }

  if (loading) {
    return (
      <Panel
        title="Loading company"
        text="Reading the latest company record from Supabase."
      />
    );
  }

  if (error || !company) {
    return (
      <Panel
        title="Company could not be loaded"
        text={error || "The company record could not be found."}
        error
      />
    );
  }

  const website =
    company.website && !company.website.startsWith("http")
      ? `https://${company.website}`
      : company.website;

  return (
    <div className="space-y-6">
    
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        Back to companies
      </Link>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">
              {company.company_name.slice(0, 2).toUpperCase()}
            </div>

            <StatusBadge status={company.status} />
          </div>

          <h1 className="mt-5 break-words text-2xl font-black tracking-tight text-slate-900">
            {company.company_name}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {company.industry || "Industry not recorded"}
            <span className="mx-2">·</span>
            {company.division || "No division selected"}
          </p>

          <div className="mt-6 space-y-3 border-y border-slate-100 py-5">
            <SidebarDetail
              label="Website"
              value={
                website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-blue-700 hover:underline"
                  >
                    {company.website}
                  </a>
                ) : (
                  "Not recorded"
                )
              }
            />

            <SidebarDetail
              label="Phone"
              value={
                company.phone ? (
                  <a
                    href={`tel:${company.phone}`}
                    className="text-blue-700 hover:underline"
                  >
                    {company.phone}
                  </a>
                ) : (
                  "Not recorded"
                )
              }
            />

            <SidebarDetail
              label="Lead source"
              value={company.lead_source || "Not recorded"}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <SidebarMetric
              label="Annual value"
              value={formatMoney(company.annual_value)}
            />
            <SidebarMetric label="People" value={String(contactCount)} />
            <SidebarMetric label="Open tasks" value="0" />
            <SidebarMetric
  label="Opportunities"
  value={String(opportunityCount)}
/>
          </div>

          <div className="mt-6 grid gap-2">
            <Link
              href={`/companies/${id}/edit`}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Edit company
            </Link>

            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete company"}
            </button>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-white px-3 shadow-sm">
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-1">
                {tabs.map((tab) => {
                  const selected = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`border-b-2 px-4 py-4 text-sm font-bold transition ${
                        selected
                          ? "border-slate-900 text-slate-900"
                          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {activeTab === "overview" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <SectionTitle
                  title="Company overview"
                  subtitle="Commercial details and account information."
                />

                <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                  <Field
                    label="Status"
                    value={company.status || "Not recorded"}
                  />
                  <Field
                    label="Annual value"
                    value={formatMoney(company.annual_value)}
                  />
                  <Field
                    label="Industry"
                    value={company.industry || "Not recorded"}
                  />
                  <Field
                    label="Division"
                    value={company.division || "Not recorded"}
                  />
                  <Field
                    label="Created"
                    value={formatDate(company.created_at)}
                  />
                  <Field
                    label="Last updated"
                    value={formatDate(company.updated_at)}
                  />
                </dl>
              </section>

              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <SectionTitle
                  title="Notes"
                  subtitle="General information and account context."
                />

                <div className="mt-5 rounded-xl bg-slate-50 p-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {company.notes ||
                      "No notes have been added to this company."}
                  </p>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "people" ? (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <ContactList companyId={company.id} />
            </section>
          ) : null}

          {activeTab === "sales" ? (
            <OpportunityList
              companyId={company.id}
                onCountChange={setOpportunityCount}
            />
          ) : null}

          {activeTab === "tasks" ? (
            <EmptyState
              title="No tasks yet"
              text="Tasks linked to this company will appear here."
              actionLabel="+ Add task"
            />
          ) : null}

          {activeTab === "activity" ? (
            <EmptyState
              title="No activity yet"
              text="Calls, emails, notes and record changes will appear here."
            />
          ) : null}

          {activeTab === "documents" ? (
            <EmptyState
              title="No documents yet"
              text="Quotes, contracts and other company documents will appear here."
              actionLabel="+ Add document"
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SidebarDetail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function SidebarMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-base font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function EmptyState({
  title,
  text,
  actionLabel,
}: {
  title: string;
  text: string;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
        ◇
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        {text}
      </p>

      {actionLabel ? (
        <button
          type="button"
          disabled
          className="mt-5 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500"
          title="This module will be added in a later sprint."
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function Panel({
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
      className={`rounded-2xl border p-10 text-center shadow-sm ${
        error
          ? "border-red-200 bg-red-50"
          : "border-[var(--border)] bg-white"
      }`}
    >
      <p className={`font-bold ${error ? "text-red-700" : "text-slate-900"}`}>
        {title}
      </p>

      <p className={`mt-2 text-sm ${error ? "text-red-600" : "text-slate-500"}`}>
        {text}
      </p>

      {error ? (
        <Link
          href="/companies"
          className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          Return to companies
        </Link>
      ) : null}
    </div>
  );
}