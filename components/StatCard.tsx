type StatCardProps = {
  title: string;
  value: string;
  note: string;
};

export default function StatCard({
  title,
  value,
  note,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--accent)]">
      <p className="text-sm font-medium text-[var(--text-secondary)]">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-[var(--text-primary)]">
        {value}
      </p>

      <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
        {note}
      </p>
    </div>
  );
}