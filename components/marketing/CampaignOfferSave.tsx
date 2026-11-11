"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveInstagridCampaignOffer } from "@/app/marketing/templates/instagrid-one/offer-actions";

type Campaign = {
  id: string;
  name: string;
  status: string;
  revision: number;
};

type Props = {
  campaigns: Campaign[];
  monthly24: string;
  monthly12: string;
  show12: boolean;
  email: string;
  phone: string;
  disabled: boolean;
};

export default function CampaignOfferSave(props: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [savedId, setSavedId] = useState("");
  const inFlight = useRef(false);

  async function save() {
    const campaign = props.campaigns.find(item => item.id === selected);
    if (!campaign || props.disabled || inFlight.current) return;

    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    setSavedId("");
    setMessage("Saving the artwork, prices and email content together...");

    try {
      const result = await saveInstagridCampaignOffer({
        campaignId: campaign.id,
        revision: campaign.revision,
        monthly24: props.monthly24,
        monthly12: props.monthly12,
        show12: props.show12,
        email: props.email,
        phone: props.phone
      });
      setFailed(!result.ok);
      setMessage(result.message);
      if (result.ok) {
        setSavedId(result.campaignId);
        router.refresh();
      }
    } catch {
      setFailed(true);
      setMessage("The connection was interrupted. Open the campaign and check its saved offer before retrying.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section aria-busy={saving}
      className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <h3 className="font-semibold">Save offer to campaign</h3>
      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Saves these prices, artwork and email content into your selected draft.
        Replaces its subject, message and contact email. Existing recipients
        are retained. Approval is required before customer sending.
      </p>

      {props.campaigns.length ? (
        <>
          <label className="block text-sm">
            Your draft campaign
            <select value={selected}
              disabled={saving || props.disabled}
              onChange={e => {
                setSelected(e.target.value);
                setMessage("");
                setSavedId("");
              }}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <option value="">Choose a campaign</option>
              {props.campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} - revision {campaign.revision}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={save}
            disabled={props.disabled || saving || !selected}
            className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {saving ? "Saving offer..." : "Save offer to selected campaign"}
          </button>
        </>
      ) : (
        <p className="text-sm">
          Create a campaign draft, or reopen one of your campaigns, then return here.
          {" "}<Link href="/marketing/campaigns" className="underline">
            Open campaigns
          </Link>
        </p>
      )}

      {message && (
        <p role={failed ? "alert" : "status"} aria-live="polite"
          className="rounded-lg border border-[var(--border)] p-3 text-sm">
          {message}
        </p>
      )}
      {savedId && (
        <Link href={`/marketing/campaigns/${savedId}`}
          className="block font-semibold text-[var(--accent)] underline">
          Open saved campaign and review
        </Link>
      )}
    </section>
  );
}