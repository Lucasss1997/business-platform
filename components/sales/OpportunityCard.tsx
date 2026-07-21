import StageBadge from "@/components/sales/StageBadge";
import type { Opportunity } from "@/components/sales/OpportunityModal";

type OpportunityCardProps = {
  opportunity: Opportunity;
  deleting?: boolean;
  companyName?: string | null;
  onEdit: () => void;
  onDelete: () => void;
};

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function OpportunityCard({
  opportunity,
  deleting = false,
  companyName,
  onEdit,
  onDelete,
}: OpportunityCardProps) {
  const value = Number(opportunity.value || 0);
  const probability = Number(opportunity.probability || 0);
  const weightedValue = value * (probability / 100);

  return (
    <article className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="break-words text-base font-black text-slate-900">
              {opportunity.title || "Untitled opportunity"}
            </h3>

            <StageBadge stage={opportunity.stage} />
          </div>

          {companyName ? (
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {companyName}
            </p>
          ) : null}

          {opportunity.notes ? (
            <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">
              {opportunity.notes}
            </p>
          ) : null}

          <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CardField label="Value" value={formatMoney(value)} />

            <CardField
              label="Probability"
              value={`${probability}%`}
            />

            <CardField
              label="Weighted value"
              value={formatMoney(weightedValue)}
            />

            <CardField
              label="Expected close"
              value={formatDate(opportunity.expected_close)}
            />

            <CardField
              label="Lead source"
              value={opportunity.source || "Not recorded"}
            />

            <CardField
              label="Assigned to"
              value={opportunity.assigned_to || "Unassigned"}
            />
          </dl>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={deleting}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}

function CardField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </dd>
    </div>
  );
}