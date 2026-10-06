"use client";

import { useEffect, useState } from "react";

export default function CampaignLoading({ stage }: { stage: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite"
      className="rounded-2xl border border-blue-500/30 bg-[var(--surface)] p-6 shadow-lg">
      <div className="flex items-center gap-4">
        <span aria-hidden="true"
          className="h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">
            Creating your campaign
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{stage}</p>
        </div>
      </div>

      <progress aria-label="Campaign generation in progress"
        className="mt-5 h-2 w-full accent-blue-600" />

      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
        <span>Keep this page open. Image creation can take a few minutes.</span>
        <span className="shrink-0 tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} elapsed
        </span>
      </div>

      {seconds >= 180 && (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          This is taking longer than usual. Wait for the result before retrying.
        </p>
      )}
    </div>
  );
}