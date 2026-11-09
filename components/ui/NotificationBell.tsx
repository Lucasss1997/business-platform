"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Item = {
  id: string;
  name: string;
  recipient_count: number;
  internal_estimate_pence: number | string;
  submitted_at: string | null;
};

type Notifications = {
  enabled: boolean;
  count: number;
  items: Item[];
};

export default function NotificationBell() {
  const pathname = usePathname();
  const [data, setData] = useState<Notifications>({
    enabled: false, count: 0, items: []
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdown = useRef<HTMLDetailsElement>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);

    try {
      const response = await fetch("/api/notifications/approvals", {
        cache: "no-store",
        signal: controller.signal
      });

      if (response.status === 401) {
        if (!controller.signal.aborted && mounted.current) {
          setData({ enabled: false, count: 0, items: [] });
          setError("");
        }
        return;
      }

      if (!response.ok) throw new Error("Notifications unavailable.");
      const next = await response.json() as Notifications;

      if (!controller.signal.aborted && mounted.current) {
        setData(next);
        setError("");
      }
    } catch {
      if (!controller.signal.aborted && mounted.current) {
        setError("Unable to refresh notifications.");
      }
    } finally {
      if (!controller.signal.aborted && mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);

    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted.current = false;
      request.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (dropdown.current) dropdown.current.open = false;
    void refresh();
  }, [pathname, refresh]);

  if (!data.enabled && !error) return null;

  return (
    <details ref={dropdown} className="relative"
      onKeyDown={event => {
        if (event.key === "Escape") {
          if (dropdown.current) dropdown.current.open = false;
          dropdown.current?.querySelector("summary")?.focus();
        }
      }}
      onToggle={event => {
        if (event.currentTarget.open) void refresh();
      }}>
      <summary
        aria-label={`Approval notifications: ${data.count} pending`}
        className="relative flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {data.count > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {data.count > 99 ? "99+" : data.count}
          </span>
        )}
        {error && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-xs text-black">!</span>}
      </summary>

      <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <h2 className="font-semibold">Awaiting your approval</h2>
          <button type="button" onClick={() => void refresh()}
            disabled={loading}
            className="text-xs font-semibold text-[var(--accent)] disabled:opacity-50">
            {loading ? "Updating..." : "Refresh"}
          </button>
        </div>

        <div aria-live="polite">
          {error && <p role="alert" className="p-4 text-sm">{error} The list may be out of date.</p>}
          {!error && data.count === 0 && (
            <p className="p-5 text-sm text-[var(--text-secondary)]">
              No campaigns awaiting approval.
            </p>
          )}
        </div>

        {data.enabled && (
          <div className="max-h-80 overflow-y-auto">
            {data.items.map(item => (
              <Link key={item.id} href={`/marketing/campaigns/${item.id}`}
                onClick={() => {
                  if (dropdown.current) dropdown.current.open = false;
                }}
                className="block border-b border-[var(--border)] p-4 hover:bg-[var(--surface-muted)]">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {item.recipient_count} recipients | Internal estimate{" "}
                  {new Intl.NumberFormat("en-GB", {
                    style: "currency", currency: "GBP"
                  }).format(Number(item.internal_estimate_pence) / 100)}
                </p>
                <span className="mt-2 block text-xs font-semibold text-[var(--accent)]">
                  Review campaign
                </span>
              </Link>
            ))}
          </div>
        )}

        <Link href="/marketing/campaigns"
          onClick={() => {
            if (dropdown.current) dropdown.current.open = false;
          }}
          className="block p-4 text-center text-sm font-semibold text-[var(--accent)]">
          View all campaigns
        </Link>
      </div>
    </details>
  );
}