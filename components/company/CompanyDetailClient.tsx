"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/lib/types/company";
import StatusBadge from "@/components/ui/StatusBadge";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
        setCompany(null);
      } else {
        setCompany(data as Company);
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

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {company.company_name}
              </h2>

              <StatusBadge status={company.status} />
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {company.industry || "Industry not recorded"}
              <span className="mx-2">·</span>
              {company.division || "No division selected"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/companies/${id}/edit`}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              Edit company
            </Link>

            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Annual value" value={formatMoney(company.annual_value)} />
        <Metric label="Status" value={company.status || "Not recorded"} />
        <Metric label="Lead source" value={company.lead_source || "Not recorded"} />
        <Metric label="Division" value={company.division || "Not recorded"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <SectionTitle
            title="Company information"
            subtitle="General commercial and account details."
          />

          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field
              label="Website"
              value={
                website ? (
                  <a
                    className="text-blue-700 hover:underline"
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {company.website}
                  </a>
                ) : (
                  "Not recorded"
                )
              }
            />

            <Field
              label="Phone"
              value={
                company.phone ? (
                  <a
                    className="text-blue-700 hover:underline"
                    href={`tel:${company.phone}`}
                  >
                    {company.phone}
                  </a>
                ) : (
                  "Not recorded"
                )
              }
            />

            <Field
              label="Industry"
              value={company.industry || "Not recorded"}
            />

            <Field
              label="Lead source"
              value={company.lead_source || "Not recorded"}
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
            title="Primary contact"
            subtitle="Main person associated with this company."
          />

          <dl className="mt-6 space-y-6">
            <Field
              label="Name"
              value={company.contact_name || "Not recorded"}
            />

            <Field
              label="Email"
              value={
                company.email ? (
                  <a
                    className="break-all text-blue-700 hover:underline"
                    href={`mailto:${company.email}`}
                  >
                    {company.email}
                  </a>
                ) : (
                  "Not recorded"
                )
              }
            />

            <Field
              label="Mobile"
              value={
                company.mobile ? (
                  <a
                    className="text-blue-700 hover:underline"
                    href={`tel:${company.mobile}`}
                  >
                    {company.mobile}
                  </a>
                ) : (
                  "Not recorded"
                )
              }
            />
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <SectionTitle
          title="Notes"
          subtitle="General information and account context."
        />

        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {company.notes || "No notes have been added to this company."}
          </p>
        </div>
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
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
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
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
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