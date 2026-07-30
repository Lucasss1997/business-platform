import type { ReactNode } from "react";
import Button from "./Button";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: ReactNode;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  children?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionHref,
  actionIcon,
  secondaryActionLabel,
  secondaryActionHref,
  children,
}: PageHeaderProps) {
  return (
    <header className="border-b border-[var(--border)] bg-white">
      <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-8">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              {eyebrow}
            </p>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] lg:text-3xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {secondaryActionLabel && secondaryActionHref && (
            <Button
              href={secondaryActionHref}
              variant="outline"
            >
              {secondaryActionLabel}
            </Button>
          )}

          {actionLabel && actionHref && (
            <Button
              href={actionHref}
              leftIcon={actionIcon}
            >
              {actionLabel}
            </Button>
          )}

          {children}
        </div>
      </div>
    </header>
  );
}