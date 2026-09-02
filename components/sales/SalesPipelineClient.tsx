"use client";

import Link from "next/link";
import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
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

const stageProbabilities: Record<OpportunityStage, number> = {
  Prospect: 10,
  Qualified: 25,
  Discovery: 40,
  "Proposal Sent": 60,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
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

  const [draggedOpportunityId, setDraggedOpportunityId] = useState<
    string | null
  >(null);

  const [dragOverStage, setDragOverStage] =
    useState<OpportunityStage | null>(null);

  const [movingId, setMovingId] = useState<string | null>(null);

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
    if (movingId) return;

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

    const activityTime = new Date().toISOString();

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
      last_activity: activityTime,
    };

    if (selectedOpportunity) {
      const previousOpportunity = selectedOpportunity;

      const { error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", selectedOpportunity.id);

      if (error) {
        setModalError(error.message);
        setSaving(false);
        return;
      }

      await logActivity({
        companyId: selectedCompanyId,
        entityType: "opportunity",
        entityId: selectedOpportunity.id,
        action: "updated",
        description: `Updated opportunity "${values.title}".`,
        metadata: {
          opportunity_title: values.title,
          old_stage: normaliseStage(previousOpportunity.stage),
          new_stage: values.stage,
          old_value: Number(previousOpportunity.value || 0),
          new_value: values.value ? Number(values.value) : 0,
          old_probability: Number(
            previousOpportunity.probability || 0,
          ),
          new_probability: Number(values.probability),
        },
      });
    } else {
      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
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
        .single();

      if (error) {
        setModalError(error.message);
        setSaving(false);
        return;
      }

      const createdOpportunity = data as Opportunity;

      await logActivity({
        companyId: selectedCompanyId,
        entityType: "opportunity",
        entityId: createdOpportunity.id,
        action: "created",
        description: `Created opportunity "${values.title}".`,
        metadata: {
          opportunity_title: values.title,
          stage: values.stage,
          value: values.value ? Number(values.value) : 0,
          probability: Number(values.probability),
        },
      });
    }

    setSaving(false);
    setModalOpen(false);
    setSelectedOpportunity(null);
    setSelectedCompanyId("");

    await loadSalesData();
  }

  async function deleteOpportunity(opportunity: Opportunity) {
    const opportunityTitle =
      opportunity.title || "Untitled opportunity";

    const confirmed = window.confirm(
      `Delete "${opportunityTitle}"? This cannot be undone.`,
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

    await logActivity({
      companyId: String(opportunity.company_id),
      entityType: "opportunity",
      entityId: opportunity.id,
      action: "deleted",
      description: `Deleted opportunity "${opportunityTitle}".`,
      metadata: {
        opportunity_title: opportunityTitle,
        stage: normaliseStage(opportunity.stage),
        value: Number(opportunity.value || 0),
        probability: Number(opportunity.probability || 0),
      },
    });

    setDeletingId(null);
    await loadSalesData();
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    opportunity: Opportunity,
  ) {
    if (movingId || deletingId) {
      event.preventDefault();
      return;
    }

    setDraggedOpportunityId(opportunity.id);
    setPageError("");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", opportunity.id);
  }

  function handleDragEnd() {
    setDraggedOpportunityId(null);
    setDragOverStage(null);
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    stage: OpportunityStage,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  }

  function handleDragLeave(
    event: DragEvent<HTMLElement>,
    stage: OpportunityStage,
  ) {
    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  }

  async function handleDrop(
    event: DragEvent<HTMLElement>,
    destinationStage: OpportunityStage,
  ) {
    event.preventDefault();

    const opportunityId =
      event.dataTransfer.getData("text/plain") ||
      draggedOpportunityId;

    setDraggedOpportunityId(null);
    setDragOverStage(null);

    if (!opportunityId || movingId) return;

    const opportunity = opportunities.find(
      (record) => record.id === opportunityId,
    );

    if (!opportunity) return;

    const originalStage = normaliseStage(opportunity.stage);

    if (originalStage === destinationStage) {
      return;
    }

    const originalProbability = Number(
      opportunity.probability || 0,
    );

    const newProbability = stageProbabilities[destinationStage];
    const activityTime = new Date().toISOString();

    setMovingId(opportunity.id);
    setPageError("");

    setOpportunities((current) =>
      current.map((record) =>
        record.id === opportunity.id
          ? {
              ...record,
              stage: destinationStage,
              status: destinationStage,
              probability: newProbability,
              last_activity: activityTime,
            }
          : record,
      ),
    );

    const { error } = await supabase
      .from("leads")
      .update({
        stage: destinationStage,
        status: destinationStage,
        probability: newProbability,
        last_activity: activityTime,
      })
      .eq("id", opportunity.id);

    if (error) {
      setOpportunities((current) =>
        current.map((record) =>
          record.id === opportunity.id
            ? {
                ...record,
                stage: originalStage,
                status: originalStage,
                probability: originalProbability,
              }
            : record,
        ),
      );

      setPageError(
        `The opportunity could not be moved: ${error.message}`,
      );

      setMovingId(null);
      return;
    }

    await logActivity({
      companyId: String(opportunity.company_id),
      entityType: "opportunity",
      entityId: opportunity.id,
      action: "stage_changed",
      description: `Moved opportunity "${
        opportunity.title || "Untitled opportunity"
      }" from ${originalStage} to ${destinationStage}.`,
      metadata: {
        opportunity_title:
          opportunity.title || "Untitled opportunity",
        old_stage: originalStage,
        new_stage: destinationStage,
        old_probability: originalProbability,
        new_probability: newProbability,
      },
    });

    setMovingId(null);
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent)]" />

        <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">
          Loading sales pipeline...
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Sales pipeline
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Drag opportunities between columns to update their sales
              stage.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={companies.length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10"
          />

          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10"
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
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-xl shadow-sm">
              ?
            </div>

            <h3 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
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
                className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95"
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
                    movingId={movingId}
                    draggedOpportunityId={draggedOpportunityId}
                    dragActive={dragOverStage === stage}
                    onEdit={openEditModal}
                    onDelete={deleteOpportunity}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
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
  movingId,
  draggedOpportunityId,
  dragActive,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  stage: OpportunityStage;
  opportunities: Opportunity[];
  companyMap: Map<string, string>;
  totalValue: number;
  deletingId: string | null;
  movingId: string | null;
  draggedOpportunityId: string | null;
  dragActive: boolean;
  onEdit: (opportunity: Opportunity) => void;
  onDelete: (opportunity: Opportunity) => void;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    opportunity: Opportunity,
  ) => void;
  onDragEnd: () => void;
  onDragOver: (
    event: DragEvent<HTMLElement>,
    stage: OpportunityStage,
  ) => void;
  onDragLeave: (
    event: DragEvent<HTMLElement>,
    stage: OpportunityStage,
  ) => void;
  onDrop: (
    event: DragEvent<HTMLElement>,
    stage: OpportunityStage,
  ) => void;
}) {
  return (
    <section
      onDragOver={(event) => onDragOver(event, stage)}
      onDragLeave={(event) => onDragLeave(event, stage)}
      onDrop={(event) => onDrop(event, stage)}
      className={`flex min-h-[460px] flex-col rounded-2xl border transition ${
        dragActive
          ? "border-[var(--accent)] bg-[var(--surface-soft)] ring-2 ring-[var(--accent)]/20"
          : "border-[var(--border)] bg-[var(--surface-soft)]"
      }`}
    >
      <header className="border-b border-[var(--border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <StageBadge stage={stage} />

          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--surface)] px-2 text-xs font-black text-[var(--text-primary)] shadow-sm">
            {opportunities.length}
          </span>
        </div>

        <p className="mt-3 text-sm font-black text-[var(--text-primary)]">
          {formatMoney(totalValue)}
        </p>
      </header>

      <div className="flex-1 space-y-3 p-3">
        {opportunities.length === 0 ? (
          <div
            className={`rounded-xl border border-dashed px-3 py-8 text-center transition ${
              dragActive
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border)] bg-[var(--surface)]/60"
            }`}
          >
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              {dragActive ? "Drop opportunity here" : "No opportunities"}
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
              moving={movingId === opportunity.id}
              dragging={draggedOpportunityId === opportunity.id}
              onEdit={() => onEdit(opportunity)}
              onDelete={() => onDelete(opportunity)}
              onDragStart={(event) =>
                onDragStart(event, opportunity)
              }
              onDragEnd={onDragEnd}
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
  moving,
  dragging,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  opportunity: Opportunity;
  companyName: string;
  deleting: boolean;
  moving: boolean;
  dragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const companyHref = `/companies/${opportunity.company_id}`;

  return (
    <article
      draggable={!deleting && !moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition active:cursor-grabbing ${
        dragging
          ? "scale-95 opacity-40"
          : "hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
      } ${moving ? "pointer-events-none opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onEdit}
        disabled={deleting || moving}
        className="block w-full text-left disabled:cursor-not-allowed"
      >
        <h3 className="break-words text-sm font-black leading-5 text-slate-900">
          {opportunity.title || "Untitled opportunity"}
        </h3>

        <p className="mt-2 text-lg font-black text-[var(--text-primary)]">
          {formatMoney(opportunity.value)}
        </p>

        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-secondary)]">Probability</span>

            <span className="font-bold text-[var(--text-primary)]">
              {Number(opportunity.probability || 0)}%
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-secondary)]">Close</span>

            <span className="text-right font-bold text-[var(--text-primary)]">
              {formatDate(opportunity.expected_close)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-secondary)]">Owner</span>

            <span className="truncate text-right font-bold text-[var(--text-primary)]">
              {opportunity.assigned_to || "Unassigned"}
            </span>
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <Link
          href={companyHref}
          draggable={false}
          className="min-w-0 truncate text-xs font-bold text-[var(--accent)] hover:underline"
        >
          {companyName}
        </Link>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting || moving}
          className="shrink-0 text-xs font-bold text-red-600 transition hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting
            ? "Deleting..."
            : moving
              ? "Moving..."
              : "Delete"}
        </button>
      </div>
    </article>
  );
}

