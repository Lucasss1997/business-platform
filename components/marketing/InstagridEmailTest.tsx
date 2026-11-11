"use client";

import { useRef, useState } from "react";
import { sendInstagridEmailTest } from "@/app/marketing/templates/instagrid-one/test-actions";

type Campaign = { id: string; name: string; status: string };

type Props = {
  campaigns: Campaign[];
  monthly24: string;
  monthly12: string;
  show12: boolean;
  email: string;
  phone: string;
  disabled: boolean;
};

export default function InstagridEmailTest(props: Props) {
  const [campaignId, setCampaignId] = useState(props.campaigns[0]?.id || "");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  if (!props.campaigns.length) return null;

  async function send() {
    if (inFlight.current || props.disabled || !campaignId) return;
    inFlight.current = true;
    setSending(true);
    setFailed(false);
    setMessage("Preparing the artwork and sending your test. Please keep this page open.");

    try {
      const result = await sendInstagridEmailTest({
        campaignId,
        monthly24: props.monthly24,
        monthly12: props.monthly12,
        show12: props.show12,
        email: props.email,
        phone: props.phone
      });
      setMessage(result.message);
      setFailed(!result.ok);
    } catch {
      setFailed(true);
      setMessage("The connection was interrupted. Check your inbox before retrying; the test may have been sent.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <section aria-busy={sending}
      className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <h3 className="font-semibold">Email preview</h3>
      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Sends only to your signed-in account email using the prices and contact
        details on screen when you click. Records a test against the selected
        campaign without changing its saved content or approval.
      </p>

      <label className="block text-sm">
        Record test against
        <select value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          disabled={sending || props.disabled}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {props.campaigns.map(campaign => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} - {campaign.status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={send}
        disabled={sending || props.disabled || !campaignId}
        className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
        {sending ? "Sending test..." : "Send preview to my email"}
      </button>

      {message && (
        <p role={failed ? "alert" : "status"} aria-live="polite"
          className={`rounded-lg border p-3 text-sm ${failed ? "border-red-400" : "border-emerald-500"}`}>
          {message}
        </p>
      )}

      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Approved artwork is copied to Mailchimp for email display.
        Allow a minute between tests. No customer audience is selected.
      </p>
    </section>
  );
}