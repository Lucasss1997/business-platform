export type PipelineMetricsData = {
  openCount: number;
  pipelineValue: number;
  weightedPipeline: number;
  wonValue: number;
};

type PipelineMetricsProps = {
  metrics: PipelineMetricsData;
};

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function PipelineMetrics({
  metrics,
}: PipelineMetricsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <PipelineMetric
        label="Open opportunities"
        value={String(metrics.openCount)}
      />

      <PipelineMetric
        label="Pipeline value"
        value={formatMoney(metrics.pipelineValue)}
      />

      <PipelineMetric
        label="Weighted pipeline"
        value={formatMoney(metrics.weightedPipeline)}
      />

      <PipelineMetric
        label="Won value"
        value={formatMoney(metrics.wonValue)}
      />
    </div>
  );
}

function PipelineMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 truncate text-xl font-black text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}