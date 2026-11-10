"use client";

import { useMemo, useState } from "react";

type Props = {
  photo: string;
  logo: string;
  monthly24: number | null;
  monthly12: number | null;
  show12: boolean;
  email: string;
  disabled: boolean;
};

const website = "https://www.mltconsultants.co.uk";
const green = "#287328";
const ink = "#141b17";

const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(value);

function escape(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[character]!));
}

export default function RentalSocialExports({
  photo, logo, monthly24, monthly12, show12, email, disabled
}: Props) {
  const [format, setFormat] = useState<"portrait" | "square">("portrait");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const height = format === "square" ? 1080 : 1350;

  const svg = useMemo(() => {
    const square = format === "square";
    const footerY = square ? 860 : 1130;
    const specsY = square ? 755 : 1025;
    const alternativeY = square ? 818 : 1088;
    const mainPrice = monthly24 === null ? "CHECK PRICE" : money(monthly24);
    const priceFont = mainPrice.length > 7 ? 92 : 130;
    const alternate = show12 && monthly12 !== null
      ? `12-month option: ${money(monthly12)} + VAT / month`
      : "Tell us what you need to power.";
    const totals = [
      monthly24 !== null
        ? `24-month total ${money(monthly24 * 24)} ex VAT.` : "",
      show12 && monthly12 !== null
        ? `12-month total ${money(monthly12 * 12)} ex VAT.` : ""
    ].filter(Boolean).join(" ");

    return `<svg xmlns="http://www.w3.org/2000/svg"
      width="1080" height="${height}" viewBox="0 0 1080 ${height}">
      <defs>
        <linearGradient id="socialPaper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f5f3ef"/>
          <stop offset="1" stop-color="#e9e7e2"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="${height}" fill="url(#socialPaper)"/>
      <path d="M1080 0H990L675 340L865 520L1080 290Z" fill="${green}"/>
      <image href="${escape(logo)}" x="42" y="24" width="130" height="130"
        preserveAspectRatio="xMidYMid meet"/>

      <g font-family="Arial,Helvetica,sans-serif" fill="${ink}">
        <text x="42" y="220" font-size="78" font-weight="900" letter-spacing="-2">SERIOUS POWER.</text>
        <text x="42" y="300" font-size="78" font-weight="900" letter-spacing="-2">SIMPLE RENTAL.</text>
        <rect x="44" y="330" width="125" height="9" fill="${green}"/>
        <text x="44" y="399" font-size="43" font-weight="800">Instagrid ONE</text>
        <text x="35" y="535" font-size="${priceFont}" font-weight="900"
          letter-spacing="-5" fill="${green}">${escape(mainPrice)}</text>
        <text x="44" y="576" font-size="31">+ VAT / month</text>
        <text x="44" y="616" font-size="31">24-month rental</text>
      </g>

      <image href="${escape(photo)}"
        x="${square ? 430 : 335}" y="${square ? 290 : 310}"
        width="${square ? 650 : 800}" height="${square ? 650 : 800}"
        preserveAspectRatio="xMidYMid meet"/>

      <g font-family="Arial,Helvetica,sans-serif" fill="${ink}">
        <text x="44" y="${square ? 671 : 820}" font-size="28" font-weight="800">No deposit. No upfront</text>
        <text x="44" y="${square ? 704 : 856}" font-size="28" font-weight="800">rental payment.</text>
        <text x="44" y="${specsY}" font-size="26" font-weight="700">3,600 W continuous</text>
        <rect x="308" y="${specsY - 25}" width="3" height="31" fill="${green}"/>
        <text x="330" y="${specsY}" font-size="26" font-weight="700">18 kW peak</text>
        <rect x="495" y="${specsY - 25}" width="3" height="31" fill="${green}"/>
        <text x="516" y="${specsY}" font-size="26" font-weight="700">20 kg</text>
        <rect x="44" y="${alternativeY - 37}" width="992" height="2" fill="${green}"/>
        <text x="44" y="${alternativeY}" font-size="30">${escape(alternate)}</text>
      </g>

      <rect x="0" y="${footerY}" width="1080" height="220" fill="${ink}"/>
      <g font-family="Arial,Helvetica,sans-serif" fill="white">
        <text x="44" y="${footerY + 43}" font-size="35" font-weight="900">LET'S TALK PORTABLE POWER.</text>
        <text x="44" y="${footerY + 79}" font-size="${email.length > 45 ? 20 : 26}">${escape(email)}</text>
        <text x="44" y="${footerY + 110}" font-size="24">mltconsultants.co.uk</text>
        <text x="44" y="${footerY + 140}" font-size="15">Rentals exclude VAT. Unit returned at the end of the agreed term.</text>
        <text x="44" y="${footerY + 161}" font-size="15">Warranty cover subject to applicable terms and exclusions.</text>
        <text x="44" y="${footerY + 182}" font-size="15">Full rental terms supplied with your quotation.</text>
        <text x="44" y="${footerY + 206}" font-size="14">${escape(totals)}</text>
      </g>
    </svg>`;
  }, [format, height, monthly24, monthly12, show12, email, logo, photo]);

  async function download() {
    if (disabled || monthly24 === null || busy) return;
    setBusy(true);
    setFailed(false);
    setMessage("Preparing your social graphic...");
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
      canvas.width = 1080;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable.");
      context.drawImage(image, 0, 0, 1080, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          value => value ? resolve(value) : reject(new Error("PNG export failed.")),
          "image/png"
        );
      });

      downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `MLT-Instagrid-ONE-${format}-1080x${height}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      const savedUrl = downloadUrl;
      window.setTimeout(() => URL.revokeObjectURL(savedUrl), 60000);
      downloadUrl = "";
      setMessage(`Your ${format} graphic is ready. Copy the caption before posting.`);
    } catch {
      setFailed(true);
      setMessage("Could not create the graphic. Please retry or send the browser error.");
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setBusy(false);
    }
  }

  async function copyCaption() {
    if (disabled || monthly24 === null) return;

    const caption = [
      "Serious power. Simple rental.",
      "",
      `Instagrid ONE from ${money(monthly24)} + VAT per month on a 24-month rental.`,
      "No deposit. No upfront rental payment.",
      "",
      "Portable, rechargeable power with 3,600 W continuous output, 18 kW peak power and a 20 kg unit weight.",
      "",
      ...(show12 && monthly12 !== null
        ? [`12-month option: ${money(monthly12)} + VAT per month.`, ""] : []),
      "Tell us what you need to power and let's discuss the right setup.",
      "",
      email,
      website,
      "",
      `24-month total: ${money(monthly24 * 24)} excluding VAT.`,
      ...(show12 && monthly12 !== null
        ? [`12-month total: ${money(monthly12 * 12)} excluding VAT.`] : []),
      "Unit returned at the end of the agreed term. Warranty cover subject to applicable terms and exclusions. Full rental terms supplied with your quotation.",
      "",
      "#Instagrid #PortablePower #BatteryPower #MLTConsultants"
    ].join("\n");

    try {
      await navigator.clipboard.writeText(caption);
      setFailed(false);
      setMessage("Social caption copied. Nothing has been published.");
    } catch {
      setFailed(true);
      setMessage("Clipboard access was blocked by your browser.");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-semibold">Social graphics</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Uses the prices above. Download an image and copy its caption for manual posting.
      </p>

      <div className="my-5 flex flex-wrap gap-3">
        <label className="text-sm">
          Format
          <select value={format} disabled={busy}
            onChange={event => {
              setFormat(event.target.value as "portrait" | "square");
              setMessage("");
            }}
            className="ml-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <option value="portrait">Portrait - 1080 x 1350</option>
            <option value="square">Square - 1080 x 1080</option>
          </select>
        </label>
        <button type="button" onClick={download} disabled={disabled || busy}
          className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
          {busy ? "Creating graphic..." : "Download social PNG"}
        </button>
        <button type="button" onClick={copyCaption} disabled={disabled || busy}
          className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50">
          Copy social caption
        </button>
      </div>

      {message && <p role={failed ? "alert" : "status"}
        className="mb-4 rounded-xl border border-[var(--border)] p-3 text-sm">
        {message}
      </p>}

      <div
        aria-label="Social graphic preview"
        className="mx-auto max-w-[600px] overflow-hidden border border-slate-200 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <p className="mt-4 text-xs text-[var(--text-secondary)]">
        Images do not contain clickable links. Include the website and contact details
        in your post caption. This does not publish to social accounts.
      </p>
    </section>
  );
}