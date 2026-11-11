import Link from "next/link";

export default function CampaignOfferPreview({
  snapshot, revision
}: {
  snapshot: unknown;
  revision: number;
}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const offer = snapshot as Record<string, unknown>;
  if (offer.template !== "instagrid-one-email-v1") return null;

  const valid = typeof offer.html === "string" &&
    offer.html.length > 0 && offer.html.length <= 200000 &&
    typeof offer.monthly24 === "number" &&
    typeof offer.contact_email === "string";

  const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6";

  if (!valid) {
    return <div role="alert" className={panel}>
      The saved offer is incomplete. Reopen the campaign and save the offer again before approval.
    </div>;
  }

  const currency = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 2
  }).format(value);

  return (
    <section className={panel + " space-y-4"}>
      <h2 className="text-lg font-semibold">Saved rental offer</h2>
      <p className="font-semibold">
        Instagrid ONE - {currency(offer.monthly24 as number)} + VAT per month
        {" "}over 24 months
      </p>
      {offer.show12 === true && typeof offer.monthly12 === "number" && (
        <p className="text-sm">
          12-month alternative: {currency(offer.monthly12)} + VAT per month
        </p>
      )}
      <p className="text-sm">Contact: {offer.contact_email as string}</p>
      <p className="text-sm text-[var(--text-secondary)]">
        This is the saved email attached to campaign revision {revision}.
        Changes in the flyer builder do not change this saved copy.
        Links are disabled inside this review preview.
      </p>

      <details open>
        <summary className="cursor-pointer font-semibold">
          View saved email
        </summary>
        <iframe
          title={`Saved Instagrid email for campaign revision ${revision}`}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={offer.html as string}
          className="mt-4 h-[1000px] w-full rounded-xl border border-[var(--border)] bg-white"
        />
      </details>

      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        To change the offer, reopen this campaign if necessary and save a replacement from the
        {" "}<Link href="/marketing/templates/instagrid-one" className="underline">
          flyer builder
        </Link>.
        Editing the subject, message or contact email separately removes the attached offer.
        Recipient-only saves retain it.
      </p>
    </section>
  );
}