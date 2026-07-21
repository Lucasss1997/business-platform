"use client";

import { useEffect, useState } from "react";

export const opportunityStages = [
  "Prospect",
  "Qualified",
  "Discovery",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export type OpportunityStage = (typeof opportunityStages)[number];

export type Opportunity = {
  id: string;
  company_id: string;
  title: string | null;
  source: string | null;
  stage: string | null;
  status?: string | null;
  value: number | null;
  probability: number | null;
  expected_close: string | null;
  assigned_to: string | null;
  notes: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string | null;
};

export type OpportunityFormData = {
  title: string;
  source: string;
  stage: OpportunityStage;
  value: string;
  probability: string;
  expected_close: string;
  assigned_to: string;
  notes: string;
};

export type OpportunityCompanyOption = {
  id: string;
  name: string;
};

type OpportunityModalProps = {
  open: boolean;
  opportunity?: Opportunity | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (values: OpportunityFormData) => Promise<void>;

  companies?: OpportunityCompanyOption[];
  selectedCompanyId?: string;
  onCompanyChange?: (companyId: string) => void;
  requireCompany?: boolean;
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

function buildInitialValues(
  opportunity?: Opportunity | null,
): OpportunityFormData {
  const stage = opportunityStages.includes(
    opportunity?.stage as OpportunityStage,
  )
    ? (opportunity?.stage as OpportunityStage)
    : "Prospect";

  return {
    title: opportunity?.title || "",
    source: opportunity?.source || "",
    stage,
    value:
      opportunity?.value === null || opportunity?.value === undefined
        ? ""
        : String(opportunity.value),
    probability:
      opportunity?.probability === null ||
      opportunity?.probability === undefined
        ? String(stageProbabilities[stage])
        : String(opportunity.probability),
    expected_close: opportunity?.expected_close || "",
    assigned_to: opportunity?.assigned_to || "",
    notes: opportunity?.notes || "",
  };
}

export default function OpportunityModal({
  open,
  opportunity,
  saving,
  error = "",
  onClose,
  onSave,
  companies = [],
  selectedCompanyId = "",
  onCompanyChange,
  requireCompany = false,
}: OpportunityModalProps) {
  const [values, setValues] = useState<OpportunityFormData>(
    buildInitialValues(opportunity),
  );

  const [validationError, setValidationError] = useState("");

  const editing = Boolean(opportunity);
  const showCompanyField = companies.length > 0 && Boolean(onCompanyChange);

  useEffect(() => {
    if (!open) return;

    setValues(buildInitialValues(opportunity));
    setValidationError("");
  }, [open, opportunity]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  function updateField<K extends keyof OpportunityFormData>(
    field: K,
    value: OpportunityFormData[K],
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleStageChange(stage: OpportunityStage) {
    setValues((current) => ({
      ...current,
      stage,
      probability: String(stageProbabilities[stage]),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");

    if (requireCompany && !selectedCompanyId) {
      setValidationError("Select a company for this opportunity.");
      return;
    }

    const title = values.title.trim();

    if (!title) {
      setValidationError("Enter an opportunity title.");
      return;
    }

    if (values.value) {
      const numericValue = Number(values.value);

      if (!Number.isFinite(numericValue) || numericValue < 0) {
        setValidationError("Enter a valid opportunity value.");
        return;
      }
    }

    const probability = Number(values.probability);

    if (
      !Number.isInteger(probability) ||
      probability < 0 ||
      probability > 100
    ) {
      setValidationError(
        "Probability must be a whole number between 0 and 100.",
      );
      return;
    }

    await onSave({
      ...values,
      title,
      source: values.source.trim(),
      assigned_to: values.assigned_to.trim(),
      notes: values.notes.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opportunity-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2
              id="opportunity-modal-title"
              className="text-xl font-black text-slate-900"
            >
              {editing ? "Edit opportunity" : "Add opportunity"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editing
                ? "Update the sales opportunity and pipeline details."
                : showCompanyField
                  ? "Create a new sales opportunity and assign it to a company."
                  : "Create a new sales opportunity for this company."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close opportunity form"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 p-6">
          {validationError || error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {validationError || error}
            </div>
          ) : null}

          {showCompanyField ? (
            <div>
              <label
                htmlFor="opportunity-company"
                className="text-sm font-bold text-slate-700"
              >
                Company
                {requireCompany ? (
                  <span className="ml-1 text-red-500">*</span>
                ) : null}
              </label>

              <select
                id="opportunity-company"
                value={selectedCompanyId}
                onChange={(event) => onCompanyChange?.(event.target.value)}
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
              >
                <option value="">Select a company</option>

                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="opportunity-title"
              className="text-sm font-bold text-slate-700"
            >
              Opportunity title
              <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              id="opportunity-title"
              type="text"
              value={values.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="For example, Managed print contract"
              autoFocus={!showCompanyField}
              disabled={saving}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="opportunity-stage"
                className="text-sm font-bold text-slate-700"
              >
                Stage
              </label>

              <select
                id="opportunity-stage"
                value={values.stage}
                onChange={(event) =>
                  handleStageChange(event.target.value as OpportunityStage)
                }
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
              >
                {opportunityStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="opportunity-probability"
                className="text-sm font-bold text-slate-700"
              >
                Probability
              </label>

              <div className="relative mt-2">
                <input
                  id="opportunity-probability"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={values.probability}
                  onChange={(event) =>
                    updateField("probability", event.target.value)
                  }
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-slate-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="opportunity-value"
                className="text-sm font-bold text-slate-700"
              >
                Opportunity value
              </label>

              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-slate-400">
                  £
                </span>

                <input
                  id="opportunity-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.value}
                  onChange={(event) =>
                    updateField("value", event.target.value)
                  }
                  placeholder="0"
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-8 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="opportunity-close"
                className="text-sm font-bold text-slate-700"
              >
                Expected close
              </label>

              <input
                id="opportunity-close"
                type="date"
                value={values.expected_close}
                onChange={(event) =>
                  updateField("expected_close", event.target.value)
                }
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="opportunity-source"
                className="text-sm font-bold text-slate-700"
              >
                Lead source
              </label>

              <input
                id="opportunity-source"
                type="text"
                value={values.source}
                onChange={(event) =>
                  updateField("source", event.target.value)
                }
                placeholder="For example, Referral"
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="opportunity-owner"
                className="text-sm font-bold text-slate-700"
              >
                Assigned to
              </label>

              <input
                id="opportunity-owner"
                type="text"
                value={values.assigned_to}
                onChange={(event) =>
                  updateField("assigned_to", event.target.value)
                }
                placeholder="Sales owner"
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="opportunity-notes"
              className="text-sm font-bold text-slate-700"
            >
              Notes
            </label>

            <textarea
              id="opportunity-notes"
              rows={5}
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Add useful context, requirements or next steps."
              disabled={saving}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? editing
                  ? "Saving changes..."
                  : "Creating opportunity..."
                : editing
                  ? "Save changes"
                  : "Create opportunity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}