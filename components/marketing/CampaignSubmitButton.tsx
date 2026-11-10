"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function CampaignSubmitButton({
  children,
  className,
  name,
  value
}: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="submit"
        name={name}
        value={value}
        disabled={pending}
        aria-disabled={pending}
        aria-busy={pending}
        className={`${className ?? ""} inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60`}
      >
        {pending && (
          <svg aria-hidden="true" viewBox="0 0 24 24"
            className="h-4 w-4 animate-spin" fill="none">
            <circle cx="12" cy="12" r="9"
              stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M12 3a9 9 0 0 1 9 9"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {pending ? "Processing..." : children}
      </button>
      <span role="status" aria-live="polite"
        className="text-sm text-[var(--text-secondary)]">
        {pending ? "Please wait while your changes are saved." : ""}
      </span>
    </span>
  );
}