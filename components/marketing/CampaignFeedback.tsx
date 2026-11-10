"use client";

import { useEffect, useState } from "react";

export default function CampaignFeedback({
  error,
  message,
  status,
  revision,
  updatedAt
}: {
  error?: string;
  message?: string;
  status: string;
  revision: number;
  updatedAt: string;
}) {
  const [visible, setVisible] = useState(false);
  const text = error || message;

  useEffect(() => {
    setVisible(Boolean(text));

    // Tell the header to refresh its pending approval count immediately.
    window.dispatchEvent(new Event("campaign-updated"));

    if (!text || error) return;
    const timer = window.setTimeout(() => setVisible(false), 12000);
    return () => window.clearTimeout(timer);
  }, [error, message, status, revision, updatedAt, text]);

  if (!text) return null;

  const detail = error
    ? error.slice(0, 2000)
    : `${message!.slice(0, 500)} Current status: ${status.replaceAll("_", " ")}.`;

  return (
    <>
      <div
        role={error ? "alert" : "status"}
        className={`rounded-2xl border p-5 ${
          error
            ? "border-red-400 bg-red-50 text-red-950"
            : "border-emerald-400 bg-emerald-50 text-emerald-950"
        }`}
      >
        <p className="font-semibold">
          {error ? "Action could not be completed" : "Campaign updated"}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{detail}</p>
      </div>

      {visible && (
        <div
          className={`fixed bottom-5 right-5 z-[100] w-[min(26rem,calc(100vw-2.5rem))] rounded-2xl border p-5 shadow-2xl ${
            error
              ? "border-red-400 bg-red-50 text-red-950"
              : "border-emerald-400 bg-emerald-50 text-emerald-950"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">
                {error ? "Action failed" : "Changes saved"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{detail}</p>
            </div>
            <button type="button" aria-label="Dismiss notification"
              onClick={() => setVisible(false)}
              className="rounded-lg px-2 py-1 font-bold">
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}