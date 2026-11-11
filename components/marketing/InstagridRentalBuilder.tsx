"use client";

import { useEffect, useMemo, useState } from "react";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import RentalSocialExports from "@/components/marketing/RentalSocialExports";
import InstagridEmailTest from "@/components/marketing/InstagridEmailTest";
import CampaignOfferSave from "@/components/marketing/CampaignOfferSave";

type Draft = {
  monthly24: string;
  monthly12: string;
  show12: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type Props = {
  photo: string;
  logo: string;
  colour: string;
  storageKey: string;
  initialName: string;
  initialEmail: string;
  testCampaigns: { id: string; name: string; status: string }[];
  offerCampaigns: { id: string; name: string; status: string; revision: number }[];
};

const website = "https://www.mltconsultants.co.uk";
const green = "#287328";
const charcoal = "#141b17";
const terms = [
  "Rentals exclude VAT. Unit returned at the end of the agreed term.",
  "Warranty cover subject to applicable terms and exclusions.",
  "Full rental terms supplied with your quotation."
];

const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(value);

function price(value: string) {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return amount > 0 && amount <= 100000 ? amount : null;
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[character]!));
}

export default function InstagridRentalBuilder({
  photo, logo, storageKey, testCampaigns, offerCampaigns
}: Props) {
  const [draft, setDraft] = useState<Draft>({
    monthly24: "250", monthly12: "450", show12: true,
    contactName: "MLT Consultants",
    contactEmail: "sales@mltconsultants.co.uk",
    contactPhone: ""
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const value = JSON.parse(saved) as Partial<Draft>;
        setDraft(current => ({
          monthly24: typeof value.monthly24 === "string" ? value.monthly24 : current.monthly24,
          monthly12: typeof value.monthly12 === "string" ? value.monthly12 : current.monthly12,
          show12: typeof value.show12 === "boolean" ? value.show12 : current.show12,
          contactName: "MLT Consultants",
          contactEmail: "sales@mltconsultants.co.uk",
          contactPhone: typeof value.contactPhone === "string" ? value.contactPhone.slice(0, 35) : ""
        }));
      }
    } catch {
      setNotice("Saved defaults could not be loaded.");
      setFailed(true);
    }
    setReady(true);
  }, [storageKey]);

  const p24 = price(draft.monthly24);
  const p12 = price(draft.monthly12);
  const email = draft.contactEmail.trim();
  const name = draft.contactName.trim();
  const phone = draft.contactPhone.trim();
  const phoneUri = phone.replace(/[^\d+]/g, "");

  const valid = p24 !== null && (!draft.show12 || p12 !== null) &&
    name.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setNotice("");
  }

  function report(text: string, error = false) {
    setNotice(text);
    setFailed(error);
  }

  const svg = useMemo(() => {
    const main = p24 === null ? "CHECK PRICE" : money(p24);
    const alternative = draft.show12 && p12 !== null
      ? `12-month option: ${money(p12)} + VAT / month`
      : "Talk to MLT about your portable power requirements.";
    const totals = [
      p24 !== null ? `24-month total ${money(p24 * 24)} ex VAT.` : "",
      draft.show12 && p12 !== null
        ? `12-month total ${money(p12 * 12)} ex VAT.` : ""
    ].filter(Boolean).join(" ");

    const mainFont = main.length > 7 ? 83 : 114;
    const contactFont = email.length > 38 ? 19 : 24;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1273" viewBox="0 0 900 1273">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f5f3ef"/>
          <stop offset="1" stop-color="#e9e7e2"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1273" fill="url(#paper)"/>
      <path d="M900 0H850L552 351L756 535L900 385Z" fill="${green}"/>
      <image href="${escape(logo)}" x="34" y="22" width="125" height="125" preserveAspectRatio="xMidYMid meet"/>
      <g font-family="Arial,Helvetica,sans-serif" fill="${charcoal}">
        <text x="34" y="211" font-size="66" font-weight="900" letter-spacing="-2">SERIOUS POWER.</text>
        <text x="34" y="281" font-size="66" font-weight="900" letter-spacing="-2">SIMPLE RENTAL.</text>
        <rect x="35" y="316" width="112" height="9" fill="${green}"/>
        <text x="35" y="390" font-size="39" font-weight="800">Instagrid ONE</text>
        <text x="28" y="515" font-size="${mainFont}" font-weight="900" letter-spacing="-5" fill="${green}">${escape(main)}</text>
        <text x="35" y="559" font-size="28">+ VAT / month</text>
        <text x="35" y="601" font-size="28">24-month rental</text>
      </g>

      <image href="${escape(photo)}" x="295" y="285" width="650" height="650" preserveAspectRatio="xMidYMid meet"/>

      <g font-family="Arial,Helvetica,sans-serif" fill="${charcoal}">
        <text x="35" y="754" font-size="28" font-weight="800">No deposit. No upfront</text>
        <text x="35" y="789" font-size="28" font-weight="800">rental payment.</text>
        <text x="35" y="874" font-size="23" font-weight="700">3,600 W continuous</text>
        <rect x="265" y="852" width="3" height="28" fill="${green}"/>
        <text x="285" y="874" font-size="23" font-weight="700">18 kW peak</text>
        <rect x="425" y="852" width="3" height="28" fill="${green}"/>
        <text x="446" y="874" font-size="23" font-weight="700">20 kg</text>
        <text x="35" y="925" font-size="24">Portable, rechargeable power for your next job.</text>
        <rect x="35" y="958" width="830" height="3" fill="${green}"/>
        <text x="35" y="1002" font-size="28">${escape(alternative)}</text>
      </g>

      <rect x="0" y="1034" width="900" height="239" fill="${charcoal}"/>
      <g font-family="Arial,Helvetica,sans-serif" fill="white">
        <text x="35" y="1083" font-size="32" font-weight="900">LET'S TALK PORTABLE POWER.</text>
        <text x="35" y="1116" font-size="18">${escape(phone)}</text>
        <a href="${escape("mailto:" + email)}">
          <text x="35" y="1150" font-size="${contactFont}" text-decoration="underline">${escape(email)}</text>
        </a>
        <a href="${website}" target="_blank">
          <text x="35" y="1181" font-size="22" text-decoration="underline">mltconsultants.co.uk</text>
        </a>
        <text x="35" y="1212" font-size="12">${escape(terms[0])}</text>
        <text x="35" y="1230" font-size="12">${escape(terms[1] + " " + terms[2])}</text>
        <text x="35" y="1253" font-size="12">${escape(totals)}</text>
      </g>
    </svg>`;
  }, [draft.show12, p24, p12, name, email, phone, logo, photo]);

  function saveDefaults() {
    if (!valid) return report("Check prices and contact details first.", true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      report("Your defaults are saved for this account in this browser.");
    } catch {
      report("Your browser could not save the defaults.", true);
    }
  }

  async function copyEmail() {
    if (!valid || p24 === null) return;
    const text = [
      "Subject: Serious power. Simple rental. Instagrid ONE from MLT.",
      "",
      "Hello,",
      "",
      "Take portable, rechargeable power to your next job with Instagrid ONE.",
      "",
      `${money(p24)} + VAT per month on a 24-month rental.`,
      "No deposit. No upfront rental payment.",
      "",
      "3,600 W continuous output, 18 kW peak power and a 20 kg unit weight.",
      "No engine to refuel or exhaust fumes at the point of use.",
      "",
      ...(draft.show12 && p12 !== null
        ? [`12-month option: ${money(p12)} + VAT per month.`, ""] : []),
      "Tell us what you need to power and let's discuss the right setup.",
      "",
      "MLT Consultants", email,
      ...(phone ? [phone] : []),
      website,
      "",
      terms.join(" "),
      "",
      `24-month total: ${money(p24 * 24)} excluding VAT.`,
      ...(draft.show12 && p12 !== null
        ? [`12-month total: ${money(p12 * 12)} excluding VAT.`] : [])
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      report("Matching email copy copied. No email has been sent.");
    } catch {
      report("Browser clipboard access was blocked.", true);
    }
  }

  async function downloadPdf() {
    if (!valid) return report("Check the prices and contact details.", true);
    setBusy(true);
    report("Creating your branded PDF with clickable links...");

    let sourceUrl = "";
    let downloadUrl = "";

    try {
      sourceUrl = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
      );

      const image = new Image();
      image.src = sourceUrl;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = 2546;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const doc = await PDFDocument.create();
      doc.setTitle("Instagrid ONE rental - MLT Consultants");
      doc.setAuthor("MLT Consultants");
      const pdfPage = doc.addPage([595.28, 841.89]);
      const artwork = await doc.embedPng(canvas.toDataURL("image/png"));
      pdfPage.drawImage(artwork, {
        x: 0, y: 0, width: 595.28, height: 841.89
      });

      function addLink(
        x: number, yTop: number, width: number, height: number, uri: string
      ) {
        const sx = 595.28 / 900;
        const sy = 841.89 / 1273;
        const annotation = doc.context.register(doc.context.obj({
          Type: PDFName.of("Annot"),
          Subtype: PDFName.of("Link"),
          Rect: [
            x * sx,
            841.89 - (yTop + height) * sy,
            (x + width) * sx,
            841.89 - yTop * sy
          ],
          Border: [0, 0, 0],
          A: {
            Type: PDFName.of("Action"),
            S: PDFName.of("URI"),
            URI: PDFString.of(uri)
          }
        }));
        const existing = pdfPage.node.Annots();
        if (existing) existing.push(annotation);
        else pdfPage.node.set(
          PDFName.of("Annots"), doc.context.obj([annotation])
        );
      }

      addLink(30, 1127, 830, 29, `mailto:${email}`);
      addLink(30, 1160, 420, 29, website);
      if (phoneUri) addLink(30, 1096, 830, 25, `tel:${phoneUri}`);

      const bytes = await doc.save();
      downloadUrl = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
      );

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "MLT-Instagrid-ONE-Rental.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      const savedUrl = downloadUrl;
      window.setTimeout(() => URL.revokeObjectURL(savedUrl), 60000);
      downloadUrl = "";

      report("PDF ready. Website and email links are clickable in the downloaded PDF.");
    } catch (error) {
      console.error("Flyer PDF creation failed:", error);
      report("PDF creation failed. Please send the browser error so we can fix it.", true);
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3";
  const button =
    "rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-5">
        <h2 className="text-lg font-semibold">Your rental offer</h2>

        <label className="block text-sm">
          24-month monthly rental, excluding VAT
          <input type="number" min="0.01" max="100000" step="0.01"
            value={draft.monthly24} disabled={!ready || busy}
            onChange={e => update("monthly24", e.target.value)}
            className={input} />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.show12}
            disabled={!ready || busy}
            onChange={e => update("show12", e.target.checked)} />
          Include 12-month alternative
        </label>

        {draft.show12 && <label className="block text-sm">
          12-month monthly rental, excluding VAT
          <input type="number" min="0.01" max="100000" step="0.01"
            value={draft.monthly12} disabled={!ready || busy}
            onChange={e => update("monthly12", e.target.value)}
            className={input} />
        </label>}



        <label className="block text-sm">
          Contact email
          <input type="email" maxLength={100} value={draft.contactEmail}
            disabled={!ready || busy}
            onChange={e => update("contactEmail", e.target.value)}
            className={input} />
        </label>

        <label className="block text-sm">
          Phone (optional)
          <input type="tel" maxLength={35} value={draft.contactPhone}
            disabled={!ready || busy}
            onChange={e => update("contactPhone", e.target.value)}
            className={input} />
        </label>

        {!valid && ready && <p className="text-sm text-red-600">
          Enter positive prices and a valid contact email.
        </p>}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={downloadPdf}
            disabled={!ready || !valid || busy} className={button}>
            {busy ? "Building PDF..." : "Download linked PDF"}
          </button>

          <button type="button" onClick={copyEmail}
            disabled={!ready || !valid || busy} className={button}>
            Copy matching email
          </button>

          <button type="button" onClick={saveDefaults}
            disabled={!ready || !valid || busy}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50">
            Save my defaults
          </button>
        </div>

        <CampaignOfferSave
          campaigns={offerCampaigns}
          monthly24={draft.monthly24}
          monthly12={draft.monthly12}
          show12={draft.show12}
          email={email}
          phone={phone}
          disabled={!ready || !valid || busy}
        />
        <InstagridEmailTest
          campaigns={testCampaigns}
          monthly24={draft.monthly24}
          monthly12={draft.monthly12}
          show12={draft.show12}
          email={email}
          phone={phone}
          disabled={!ready || !valid || busy}
        />
        {notice && <p role={failed ? "alert" : "status"}
          className="rounded-xl border border-[var(--border)] p-3 text-sm">
          {notice}
        </p>}

        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          Prices and contact details are editable. Defaults are saved per account
          in this browser. No customer campaign is sent from this editor.
        </p>
      </div>

      <div className="min-w-0">
        <div
          aria-label={`Instagrid ONE rental flyer. ${p24 === null ? "Check price" : money(p24)} plus VAT monthly over 24 months. Contact ${email}.`}
          className="mx-auto max-w-[900px] overflow-hidden border border-slate-200 shadow-xl [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-3 text-center text-xs text-[var(--text-secondary)]">
          Live preview. Website and email are linked in the preview and PDF.
        </p>
        <RentalSocialExports
          photo={photo}
          logo={logo}
          monthly24={p24}
          monthly12={p12}
          show12={draft.show12}
          email={email}
          disabled={!ready || !valid || busy}
        />
      </div>
    </div>
  );
}