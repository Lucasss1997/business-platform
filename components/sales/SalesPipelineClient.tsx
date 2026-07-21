"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import OpportunityModal, {
  opportunityStages,
  type Opportunity,
  type OpportunityCompanyOption,
  type OpportunityFormData,
  type OpportunityStage,
} from "@/components/sales/OpportunityModal";
import PipelineMetrics, {
  type PipelineMetricsData,
} from "@/components/sales/PipelineMetrics";
import StageBadge from "@/components/sales/StageBadge";

type CompanyRecord = {
  id: string;
  company_name: string;
};

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "No close date";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "No close date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normaliseStage(stage: string | null): OpportunityStage {
  if (opportunityStages.includes(stage as OpportunityStage)) {
    return stage as OpportunityStage;
  }

  return "Prospect";
}

export default function SalesPipelineClient() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSalesData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    const [companiesResult, opportunitiesResult] = await Promise.all([
      supabase
        .from("companies")
        .select("id, company_name")
        .order("company_name", { ascending: true }),

      supabase
        .from("leads")
        .select(
          `
            id,
            company_id,
            title,
            source,
            status,
            stage,
            value,
            probability,
            expected_close,
            assigned_to,
            notes,
            last_activity,
            created_at,
            updated_at
          `,
        )
        .order("created_at", { ascending: false }),
    ]);

    if (companiesResult.error) {
      setPageError(companiesResult.error.message);
      setCompanies([]);
      setOpportunities([]);
      setLoading(false);
      return;
    }

    if (opportunitiesResult.error) {
      setPageError(opportunitiesResult.error.message);
      setCompanies((companiesResult.data || []) as CompanyRecord[]);
      setOpportunities([]);
      setLoading(false);
      return;
    }

    setCompanies((companiesResult.data || []) as CompanyRecord[]);
    setOpportunities((opportunitiesResult.data || []) as Opportunity[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSalesData();
  }, [loadSalesData]);

  const companyMap = useMemo(() => {
    return new Map(
      companies.map((company) => [
        String(company.id),
        company.company_name,
      ]),
    );
  }, [companies]);

  const metrics = useMemo<PipelineMetricsData>(() => {
    const openOpportunities = opportunities.filter((opportunity) => {
      const stage = normaliseStage(opportunity.stage);

      return stage !== "Won" && stage !== "Lost";
    });

    const pipelineValue = openOpportunities.reduce(
      (total, opportunity) =>
        total + Number(opportunity.value || 0),
      0,
    );

    const weightedPipeline = openOpportunities.reduce(
      (total, opportunity) => {
        const value = Number(opportunity.value || 0);
        const probability = Number(opportunity.probability || 0);

        return total + value * (probability / 100);
      },
      0,
    );

    const wonValue = opportunities
      .filter(
        (opportunity) =>
          normaliseStage(opportunity.stage) === "Won",
      )
      .reduce(
        (total, opportunity) =>
          total + Number(opportunity.value || 0),
        0,
      );

    return {
      openCount: openOpportunities.length,
      pipelineValue,
      weightedPipeline,
      wonValue,
    };
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    return opportunities.filter((opportunity) => {
      const companyName =
        companyMap.get(String(opportunity.company_id)) || "";

      const stage = normaliseStage(opportunity.stage);

      const matchesStage =
        stageFilter === "All" || stage === stageFilter;

      const matchesSearch =
        !normalisedSearch ||
        opportunity.title
          ?.toLowerCase()
          .includes(normalisedSearch) ||
        companyName.toLowerCase().includes(normalisedSearch) ||
        opportunity.assigned_to
          ?.toLowerCase()
          .includes(normalisedSearch) ||
        opportunity.source
          ?.toLowerCase()
          .includes(normalisedSearch);

      return matchesStage && matchesSearch;
    });
  }, [opportunities, companyMap, search, stageFilter]);

  const groupedOpportunities = useMemo(() => {
    const groups = new Map<OpportunityStage, Opportunity[]>();

    opportunityStages.forEach((stage) => {
      groups.set(stage, []);
    });

    filteredOpportunities.forEach((opportunity) => {
      const stage = normaliseStage(opportunity.stage);
      groups.get(stage)?.push(opportunity);
    });

    return groups;
  }, [filteredOpportunities]);

  const companyOptions = useMemo<OpportunityCompanyOption[]>(
    () =>
      companies.map((company) => ({
        id: String(company.id),
        name: company.company_name,
      })),
    [companies],
  );

  function openCreateModal() {
    setSelectedOpportunity(null);
    setSelectedCompanyId("");
    setModalError("");
    setModalOpen(true);
  }

  function openEditModal(opportunity: Opportunity) {
    setSelectedOpportunity(opportunity);
    setSelectedCompanyId(String(opportunity.company_id));
    setModalError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setSelectedOpportunity(null);
    setSelectedCompanyId("");
    setModalError("");
  }

  async function saveOpportunity(values: OpportunityFormData) {
    if (!selectedCompanyId) {
      setModalError("Select a company for this opportunity.");
      return;
    }

    setSaving(true);
    setModalError("");

    const payload = {
      company_id: selectedCompanyId,
      title: values.title,
      source: values.source || null,
      stage: values.stage,
      status: values.stage,
      value: values.value ? Number(values.value) : null,
      probability: Number(values.probability),
      expected_close: values.expected_close || null,
      assigned_to: values.assigned_to || null,
      notes: values.notes || null,
      last_activity: new Date().toISOString(),
    };

    const result = selectedOpportunity
      ? await supabase
          .from("leads")
          .update(payload)
          .eq("id", selectedOpportunity.id)
      : await supabase.from("leads").insert(payload);

    if (result.error) {
      setModalError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setSelectedOpportunity(null);
    setSelectedCompanyId("");

    await loadSalesData();
  }

  async function deleteOpportunity(opportunity: Opportunity) {
    const confirmed = window.confirm(
      `Delete "${
        opportunity.title || "this opportunity"
      }"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(opportunity.id);
    setPageError("");

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", opportunity.id);

    if (error) {
      setPageError(error.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await loadSalesData();
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

        <p className="mt-4 text-sm font-semibold text-slate-600">
          Loading sales pipeline...
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Sales pipeline
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage opportunities across every company.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={companies.length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add opportunity
          </button>
        </div>

        {pageError ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {pageError}
          </div>
        ) : null}

        {companies.length === 0 ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Add a company before creating a sales opportunity.
          </div>
        ) : null}

        <div className="mt-6">
          <PipelineMetrics metrics={metrics} />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search opportunities, companies or owners..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />

          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="All">All stages</option>

            {opportunityStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        {opportunities.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
              ◇
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">
              No opportunities yet
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Create the first opportunity to start building the global
              sales pipeline.
            </p>

            {companies.length > 0 ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                + Add opportunity
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto pb-3">
            <div className="grid min-w-[2100px] grid-cols-7 gap-4">
              {opportunityStages.map((stage) => {
                const stageOpportunities =
                  groupedOpportunities.get(stage) || [];

                const stageValue = stageOpportunities.reduce(
                  (total, opportunity) =>
                    total + Number(opportunity.value || 0),
                  0,
                );

                return (
                  <PipelineColumn
                    key={stage}
                    stage={stage}
                    opportunities={stageOpportunities}
                    companyMap={companyMap}
                    totalValue={stageValue}
                    deletingId={deletingId}
                    onEdit={openEditModal}
                    onDelete={deleteOpportunity}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      <OpportunityModal
        open={modalOpen}
        opportunity={selectedOpportunity}
        saving={saving}
        error={modalError}
        companies={companyOptions}
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={setSelectedCompanyId}
        requireCompany
        onClose={closeModal}
        onSave={saveOpportunity}
      />
    </>
  );
}

function PipelineColumn({
  stage,
  opportunities,
  companyMap,
  totalValue,
  deletingId,
  onEdit,
  onDelete,
}: {
  stage: OpportunityStage;
  opportunities: Opportunity[];
  companyMap: Map<string, string>;
  totalValue: number;
  deletingId: string | null;
  onEdit: (opportunity: Opportunity) => void;
  onDelete: (opportunity: Opportunity) => void;
}) {
  return (
    <section className="flex min-h-[460px] flex-col rounded-2xl border border-slate-200 bg-slate-50">
      <header className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <StageBadge stage={stage} />

          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-xs font-black text-slate-700 shadow-sm">
            {opportunities.length}
          </span>
        </div>

        <p className="mt-3 text-sm font-black text-slate-900">
          {formatMoney(totalValue)}
        </p>
      </header>

      <div className="flex-1 space-y-3 p-3">
        {opportunities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-8 text-center">
            <p className="text-xs font-semibold text-slate-400">
              No opportunities
            </p>
          </div>
        ) : (
          opportunities.map((opportunity) => (
            <PipelineCard
              key={opportunity.id}
              opportunity={opportunity}
              companyName={
                companyMap.get(String(opportunity.company_id)) ||
                "Unknown company"
              }
              deleting={deletingId === opportunity.id}
              onEdit={() => onEdit(opportunity)}
              onDelete={() => onDelete(opportunity)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function PipelineCard({
  opportunity,
  companyName,
  deleting,
  onEdit,
  onDelete,
}: {
  opportunity: Opportunity;
  companyName: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const companyHref = `/companies/${opportunity.company_id}`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <button
        type="button"
        onClick={onEdit}
        disabled={deleting}
        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <h3 className="break-words text-sm font-black leading-5 text-slate-900">
          {opportunity.title || "Untitled opportunity"}
        </h3>

        <p className="mt-2 text-lg font-black text-slate-900">
          {formatMoney(opportunity.value)}
        </p>

        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Probability</span>

            <span className="font-bold text-slate-700">
              {Number(opportunity.probability || 0)}%
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Close</span>

            <span className="text-right font-bold text-slate-700">
              {formatDate(opportunity.expected_close)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Owner</span>

            <span className="truncate text-right font-bold text-slate-700">
              {opportunity.assigned_to || "Unassigned"}
            </span>
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <Link
          href={companyHref}
          className="min-w-0 truncate text-xs font-bold text-blue-700 hover:underline"
        >
          {companyName}
        </Link>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="shrink-0 text-xs font-bold text-red-600 transition hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </article>
  );
}