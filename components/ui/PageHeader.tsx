import Link from "next/link";

export default function PageHeader({
  eyebrow = "The Platform",
  title,
  subtitle,
  actionLabel,
  actionHref,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <header className="border-b border-[var(--border)] bg-white px-6 py-6 lg:px-10">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="inline-flex w-fit items-center justify-center rounded-xl bg-[var(--text-primary)] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90">
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
