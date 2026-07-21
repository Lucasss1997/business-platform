"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import OpportunityModal, {
  type Opportunity,
  type OpportunityFormData,
} from "@/components/sales/OpportunityModal";
import OpportunityCard from "@/components/sales/OpportunityCard";
import PipelineMetrics, {
  type PipelineMetricsData,
} from "@/components/sales/PipelineMetrics";

type OpportunityListProps = {
  companyId: string | number;
  onCountChange?: (count: number) => void;
};

export default function OpportunityList({
  companyId,
  onCountChange,
}: OpportunityListProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    setPageError("");

    const { data, error } = await supabase
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
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      setPageError(error.message);
      setOpportunities([]);
      onCountChange?.(0);
      setLoading(false);
      return;
    }

    const records = (data || []) as Opportunity[];

    setOpportunities(records);
    onCountChange?.(records.length);
    setLoading(false);
  }, [companyId, onCountChange]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const metrics = useMemo<PipelineMetricsData>(() => {
    const openOpportunities = opportunities.filter(
      (opportunity) =>
        opportunity.stage !== "Won" &&
        opportunity.stage !== "Lost",
    );

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
      .filter((opportunity) => opportunity.stage === "Won")
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

  function openCreateModal() {
    setSelectedOpportunity(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEditModal(opportunity: Opportunity) {
    setSelectedOpportunity(opportunity);
    setModalError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setSelectedOpportunity(null);
    setModalError("");
  }

  async function saveOpportunity(values: OpportunityFormData) {
    setSaving(true);
    setModalError("");

    const payload = {
      company_id: companyId,
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
          .eq("company_id", companyId)
      : await supabase.from("leads").insert(payload);

    if (result.error) {
      setModalError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setSelectedOpportunity(null);

    await loadOpportunities();
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
      .eq("id", opportunity.id)
      .eq("company_id", companyId);

    if (error) {
      setPageError(error.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await loadOpportunities();
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

        <p className="mt-4 text-sm font-semibold text-slate-600">
          Loading sales opportunities...
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Sales opportunities
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Track pipeline value, sales stages and expected closing
              dates.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            + Add opportunity
          </button>
        </div>

        {pageError ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {pageError}
          </div>
        ) : null}

        <div className="mt-6">
          <PipelineMetrics metrics={metrics} />
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
              Add the first opportunity to start tracking this
              company&apos;s sales pipeline.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              + Add opportunity
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                deleting={deletingId === opportunity.id}
                onEdit={() => openEditModal(opportunity)}
                onDelete={() => deleteOpportunity(opportunity)}
              />
            ))}
          </div>
        )}
      </section>

      <OpportunityModal
        open={modalOpen}
        opportunity={selectedOpportunity}
        saving={saving}
        error={modalError}
        onClose={closeModal}
        onSave={saveOpportunity}
      />
    </>
  );
}