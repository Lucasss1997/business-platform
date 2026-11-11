"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  manageCampaignDelivery,
  type DeliveryReport
} from "@/app/marketing/campaigns/delivery-actions";

export default function CampaignDeliveryControls({
  campaignId, revision, status
}: {
  campaignId: string;
  revision: number;
  status: string;
}) {
  const router = useRouter();
  const [report, setReport] = useState<DeliveryReport | null>(null);
  const [busy, setBusy] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const inFlight = useRef(false);

  async function run(operation: "check" | "prepare" | "send" | "refresh") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(operation);

    try {
      const result = await manageCampaignDelivery({
        campaignId, revision, operation,
        confirmed: operation === "send" ? confirmed : undefined
      });
      setReport(result);
      setConfirmed(false);
      router.refresh();
    } catch {
      setReport({
        ok: false,
        message: "The connection was interrupted. Refresh delivery status before taking further action. Do not repeat a send."
      });
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  const button = "rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50";

  return (
    <section aria-busy={Boolean(busy)}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">Customer delivery</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        Check the saved contacts, prepare the approved revision, then review
        the final email and business footer before sending.
        All selected contacts must already be subscribed in Mailchimp.
      </p>

      <div className="flex flex-wrap gap-3">
        {status === "approved" && !report?.deliveryStatus && (
          <button type="button" disabled={Boolean(busy)}
            className={button} onClick={() => run("check")}>
            {busy === "check" ? "Checking recipients..." : "Check recipients"}
          </button>
        )}

        {report?.canPrepare && status === "approved" && (
          <button type="button" disabled={Boolean(busy)}
            className={button} onClick={() => run("prepare")}>
            {busy === "prepare" ? "Preparing campaign..." : "Prepare approved campaign"}
          </button>
        )}

        <button type="button" disabled={Boolean(busy)}
          className={button} onClick={() => run("refresh")}>
          {busy === "refresh" ? "Refreshing..." : "Refresh delivery status"}
        </button>
      </div>

      {busy && (
        <p role="status" aria-live="polite" className="text-sm">
          {busy === "send"
            ? "Requesting the customer send. Please keep this page open."
            : "Working with Mailchimp. Please keep this page open."}
        </p>
      )}

      {report && (
        <div role={report.ok ? "status" : "alert"}
          className="space-y-2 rounded-xl border border-[var(--border)] p-4 text-sm">
          <p>{report.message}</p>
          {report.total !== undefined && <p>Saved recipients: {report.total}</p>}
          {report.subscribed !== undefined && <p>Subscribed matches: {report.subscribed}</p>}
          {report.sender && <p>Sender: {report.sender}</p>}
          {report.deliveryStatus && <p>Delivery record: {report.deliveryStatus.replaceAll("_", " ")}</p>}
          {report.providerId && <p className="break-all">Mailchimp reference: {report.providerId}</p>}
          {report.emailsSent !== undefined && <p>Mailchimp emails sent: {report.emailsSent}</p>}

          {Boolean(report.blocked?.length) && (
            <details>
              <summary className="cursor-pointer font-semibold">
                Contacts not ready ({report.blocked!.length})
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto">
                {report.blocked!.map(email => <p key={email}>{email}</p>)}
              </div>
            </details>
          )}
        </div>
      )}

      {report?.previewHtml && (
        <details open>
          <summary className="cursor-pointer font-semibold">
            Final prepared email, including business footer
          </summary>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Scroll inside the preview to inspect the footer. Links are disabled here.
          </p>
          <iframe title="Final prepared customer email"
            sandbox="" referrerPolicy="no-referrer"
            srcDoc={report.previewHtml}
            className="mt-3 h-[1000px] w-full rounded-xl border border-[var(--border)] bg-white" />
        </details>
      )}

      {report?.canSend && (
        <div className="space-y-4 rounded-xl border border-emerald-500 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={confirmed} disabled={Boolean(busy)}
              onChange={e => setConfirmed(e.target.checked)} className="mt-1" />
            I have reviewed the final email, business address, unsubscribe footer
            and saved recipient list. Send this approved campaign to
            {" "}{report.total} recipients.
          </label>
          <button type="button" onClick={() => run("send")}
            disabled={!confirmed || Boolean(busy)}
            className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
            {busy === "send" ? "Sending approved campaign..." : "Send approved campaign"}
          </button>
        </div>
      )}

      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Preparation does not send an email. The send button sends a real customer
        campaign. Duplicate sends are blocked. If a result is uncertain, use
        Refresh delivery status rather than starting another campaign.
      </p>
    </section>
  );
}