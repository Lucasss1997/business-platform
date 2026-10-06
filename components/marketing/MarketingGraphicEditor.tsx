"use client";

import { useEffect, useRef, useState } from "react";
import { getMarketingBranding, saveMarketingBrandLogo } from "@/app/marketing/branding-actions";

const field =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load an image."));
    image.src = src;
  });
}

async function imageData(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load the saved background.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the image."));
    reader.readAsDataURL(blob);
  });
}

function cover(
  ctx: CanvasRenderingContext2D, image: HTMLImageElement,
  x: number, y: number, width: number, height: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  ctx.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height
  );
}

function fitImage(
  ctx: CanvasRenderingContext2D, image: HTMLImageElement,
  x: number, y: number, width: number, height: number
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function productCrop(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Product canvas unavailable.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 30) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left) throw new Error("Product photograph is empty.");
  return { canvas, left, top, width: right - left + 1, height: bottom - top + 1 };
}

function wrappedText(
  ctx: CanvasRenderingContext2D, text: string, width: number
) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function MarketingGraphicEditor({
  backgroundUrl,
  initialProduct = "",
  productName = "",
  productBrand = "",
  integrated = false, layout = "left", finishedArtwork = false,
  sector = "Construction",
  initialHeadline = "",
  initialSupport = "",
  onPreviewReady
}: {
  backgroundUrl: string;
  initialProduct?: string;
  productName?: string;
  productBrand?: string;
  integrated?: boolean; layout?: "left" | "right" | "wide"; finishedArtwork?: boolean;
  sector?: string;
  initialHeadline?: string;
  initialSupport?: string;
  onPreviewReady?: (image: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState("");
  const [logo, setLogo] = useState("");
  const [brandName, setBrandName] = useState(productBrand);
  const [accent, setAccent] = useState("#159456");
  const sectorHeadlines: Record<string, string> = {
    Construction: "POWER IS A PROJECT DECISION.",
    Rail: "PLAN THE WORK. PLAN THE POWER.",
    Utilities: "PUT POWER IN THE PROJECT PLAN.",
    Events: "BEHIND THE EVENT. A POWER PLAN."
  };
  const [headline, setHeadline] = useState(
    initialHeadline || sectorHeadlines[sector] || sectorHeadlines.Construction
  );
  const [productChecked, setProductChecked] = useState(false);
  const [support, setSupport] = useState(initialSupport || "Talk to our team about your project requirements.");
  const [category, setCategory] = useState("PROJECT POWER");
  const [email, setEmail] = useState("sales@mltconsultants.co.uk");
  const [product, setProduct] = useState(initialProduct);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Loading saved campaign assets...");
  const [showLogo, setShowLogo] = useState(false);
  const [brandChecked, setBrandChecked] = useState(false); const [savingLogo, setSavingLogo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [bg, branding] = await Promise.all([
          imageData(backgroundUrl), getMarketingBranding(productBrand || undefined)
        ]);
        if (cancelled) return;
        setBackground(bg);
        setLogo(branding.logo);
        setBrandName(productBrand || branding.name);
        setAccent(branding.colour || "#159456");
        setMessage("Edit the message and check the brand identity before downloading.");
      } catch (error) {
        if (!cancelled) setMessage(
          error instanceof Error ? error.message : "Unable to load campaign assets."
        );
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [backgroundUrl, productBrand]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas || !background) return;

      try {
        const [bg, photo, logoImage] = await Promise.all([
          loadImage(background),
          product ? loadImage(product) : Promise.resolve(null),
          logo && (showLogo || finishedArtwork) ? loadImage(logo) : Promise.resolve(null)
        ]);
        if (cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Graphic preview unavailable.");

        if (finishedArtwork) {
          ctx.clearRect(0, 0, 1080, 1080);
          cover(ctx, bg, 0, 0, 1080, 1080);
          if (logoImage) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(810, 950, 238, 105);
            fitImage(ctx, logoImage, 822, 960, 214, 85);
          }
          setReady(Boolean(productChecked && brandChecked && logoImage));
          onPreviewReady?.(productChecked && brandChecked && logoImage ? canvas.toDataURL("image/png") : "");
          setMessage("Check product accuracy, every word, the brand name and sales email before approving.");
          return;
        }

        if (integrated) {
          ctx.clearRect(0, 0, 1080, 1080);
          cover(ctx, bg, 0, 0, 1080, 1080);

          // Text remains precise and editable; the product is already in the scene.
          const shade = ctx.createLinearGradient(0, 0, 0, 700);
          shade.addColorStop(0, "rgba(8,20,34,0.65)");
          shade.addColorStop(0.7, "rgba(8,20,34,0.12)");
          shade.addColorStop(1, "rgba(8,20,34,0)");
          ctx.fillStyle = shade;
          ctx.fillRect(0, 0, 1080, 1080);

          ctx.fillStyle = "#ffffff";
          ctx.font = "24px Arial";
          ctx.fillText(brandName.trim().toUpperCase(), 60, 73, 760);

          const textX = layout === "right" ? 350 : 60;
          const textWidth = layout === "wide" ? 940 : 670;
          let size = layout === "wide" ? 68 : 72;
          let titleLines: string[] = [];
          while (size >= 40) {
            ctx.font = `900 ${size}px Arial`;
            titleLines = wrappedText(ctx, headline.toUpperCase(), textWidth);
            if (titleLines.length <= 3) break;
            size -= 2;
          }
          if (titleLines.length > 3) {
            throw new Error("Shorten the headline to fit three lines.");
          }
          titleLines.forEach((line, index) =>
            ctx.fillText(line, textX, 168 + index * size * 1.04)
          );

          const titleBottom = 168 + (titleLines.length - 1) * size * 1.04;
          ctx.fillStyle = accent;
          ctx.fillRect(textX, titleBottom + 24, 72, 4);

          ctx.fillStyle = "#ffffff";
          ctx.font = "27px Arial";
          const caption = support || (productName ? `Explore the ${productName}.` : "");
          const captionLines = wrappedText(ctx, caption, textWidth);
          if (captionLines.length > 2) throw new Error("Shorten the product caption.");
          captionLines.forEach((line, index) =>
            ctx.fillText(line, textX, titleBottom + 75 + index * 34)
          );

          const footerShade = ctx.createLinearGradient(0, 910, 0, 1080);
          footerShade.addColorStop(0, "rgba(8,20,34,0)");
          footerShade.addColorStop(1, "rgba(8,20,34,0.9)");
          ctx.fillStyle = footerShade;
          ctx.fillRect(0, 910, 1080, 170);

          ctx.fillStyle = "#ffffff";
          ctx.font = "24px Arial";
          ctx.fillText("Discuss your project requirements", 60, 989);
          ctx.font = "bold 29px Arial";
          ctx.fillText(email.trim(), 60, 1032, 940);

          if (logoImage) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(858, 42, 172, 78);
            fitImage(ctx, logoImage, 866, 50, 156, 62);
          }

          setReady(Boolean(
            productChecked && headline.trim() && brandName.trim() &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
          ));
          onPreviewReady?.(
            productChecked && headline.trim() && brandName.trim() &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
              ? canvas.toDataURL("image/png")
              : ""
          );
          return;
        }

        const navy = "#102436";
        const mint = "#c6f3cf";

        ctx.clearRect(0, 0, 1080, 1080);
        ctx.fillStyle = "#f2f4f0";
        ctx.fillRect(0, 0, 1080, 1080);

        // Scene is context; the exact product photo stays separate.
        cover(ctx, bg, 470, 0, 610, 340);
        const fade = ctx.createLinearGradient(0, 160, 0, 355);
        fade.addColorStop(0, "rgba(242,244,240,0)");
        fade.addColorStop(1, "#f2f4f0");
        ctx.fillStyle = fade;
        ctx.fillRect(470, 160, 610, 195);

        ctx.fillStyle = navy;
        ctx.fillRect(0, 0, 470, 950);
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, 1080, 12);

        // Editorial hierarchy, with fitted type rather than clipped lines.
        ctx.fillStyle = mint;
        ctx.font = "bold 18px Arial";
        ctx.fillText(category.trim().toUpperCase(), 48, 86, 374);
        ctx.fillStyle = "#ffffff";

        let fontSize = 68;
        let lines: string[] = [];
        while (fontSize >= 36) {
          ctx.font = `bold ${fontSize}px Arial`;
          lines = wrappedText(ctx, headline, 374);
          if (lines.length * fontSize * 1.13 <= 420) break;
          fontSize -= 2;
        }
        if (lines.length * fontSize * 1.13 > 420) {
          throw new Error("Shorten the headline to fit the design.");
        }
        lines.forEach((line, index) =>
          ctx.fillText(line, 48, 178 + index * fontSize * 1.13)
        );

        ctx.fillStyle = mint;
        ctx.fillRect(48, 650, 64, 5);
        ctx.fillStyle = "#d5dee4";
        ctx.font = "25px Arial";
        const supportingLines = wrappedText(ctx, support, 374);
        if (supportingLines.length > 5) {
          throw new Error("Shorten the supporting message to fit the design.");
        }
        supportingLines.forEach((line, index) =>
          ctx.fillText(line, 48, 710 + index * 35)
        );

        // A large studio product display avoids implying a real installation.
        if (photo) {
          const crop = productCrop(photo);
          const scale = Math.min(530 / crop.width, 475 / crop.height);
          const w = crop.width * scale;
          const h = crop.height * scale;

          const shadow = ctx.createRadialGradient(775, 825, 10, 775, 825, 230);
          shadow.addColorStop(0, "rgba(16,36,54,0.15)");
          shadow.addColorStop(1, "rgba(16,36,54,0)");
          ctx.save();
          ctx.translate(775, 825);
          ctx.scale(1, 0.16);
          ctx.fillStyle = shadow;
          ctx.translate(-775, -825);
          ctx.fillRect(530, 570, 490, 510);
          ctx.restore();

          ctx.drawImage(
            crop.canvas, crop.left, crop.top, crop.width, crop.height,
            775 - w / 2, 825 - h, w, h
          );
        }

        ctx.fillStyle = navy;
        ctx.font = "bold 29px Arial";
        const nameLines = wrappedText(ctx, productName || "Discuss your next project", 510);
        if (nameLines.length > 2) throw new Error("Product name is too long for this layout.");
        nameLines.forEach((line, index) =>
          ctx.fillText(line, 510, 885 + index * 34)
        );

        // Clear reseller identity and one readable contact line.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 950, 1080, 130);
        ctx.fillStyle = accent;
        ctx.fillRect(0, 950, 1080, 4);

        if (logoImage) {
          fitImage(ctx, logoImage, 38, 975, 230, 75);
        } else {
          ctx.fillStyle = navy;
          ctx.font = "bold 23px Arial";
          const brandLines = wrappedText(ctx, brandName, 245);
          brandLines.slice(0, 2).forEach((line, index) =>
            ctx.fillText(line, 38, 1004 + index * 30)
          );
        }

        ctx.fillStyle = navy;
        ctx.font = "bold 20px Arial";
        ctx.fillText("LET'S DISCUSS YOUR PROJECT", 315, 992);
        ctx.font = "26px Arial";
        ctx.fillText(email.trim(), 315, 1033, 720);

        setReady(Boolean(
          photo && headline.trim() && brandName.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ));
      } catch (error) {
        if (!cancelled) setMessage(
          error instanceof Error ? error.message : "Unable to render the graphic."
        );
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [background, product, logo, showLogo, brandName, accent,
      headline, support, category, email, productName, integrated, layout, productChecked, brandChecked, finishedArtwork, onPreviewReady]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    if (file.type !== "image/png" || file.size > 5 * 1024 * 1024) {
      setMessage("Choose a transparent PNG up to 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProduct(String(reader.result));
    reader.onerror = () => setMessage("Unable to read product photograph.");
    reader.readAsDataURL(file);
  }

  function download() {
    if (!ready || !canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        setMessage("Unable to export the graphic.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(productName || "marketing").replace(/[^a-z0-9]+/gi, "-")}-campaign.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, "image/png");
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} width={1080} height={1080}
        aria-label="Finished campaign preview"
        className="w-full rounded-xl border border-[var(--border)]" />

      {integrated && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm font-semibold">Approved reference photograph</p>
          {initialProduct && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initialProduct} alt={`${productName} approved reference`}
              className="max-h-44 w-full rounded-lg bg-white object-contain" />
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={productChecked} className="mt-1"
              onChange={(event) => setProductChecked(event.target.checked)} />
            <span>
              I have compared the generated equipment with this reference,
              checked the model, physical details and contact information,
              and reviewed the graphic for publication.
            </span>
          </label>
        </div>
      )}
      {!finishedArtwork && <>
      <label className="block text-sm font-medium">
        Campaign label
        <input className={field} value={category} maxLength={30}
          onChange={(event) => setCategory(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Headline
        <textarea className={field} value={headline} maxLength={110} rows={2}
          onChange={(event) => setHeadline(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Supporting message
        <textarea className={field} value={support} maxLength={150} rows={3}
          onChange={(event) => setSupport(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Brand name
        <input className={field} value={brandName} maxLength={60}
          onChange={(event) => setBrandName(event.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showLogo}
          onChange={(event) => setShowLogo(event.target.checked)} />
        Use organisation logo — check it matches this campaign's brand
      </label>
      <label className="block text-sm font-medium">
        Contact email
        <input className={field} type="email" value={email} maxLength={80}
          onChange={(event) => setEmail(event.target.value)} />
      </label>
      {!initialProduct && (
        <label className="block text-sm font-medium">
          Product photograph
          <input className={field} type="file" accept="image/png"
            onChange={(event) => void choosePhoto(event.target.files?.[0])} />
        </label>
      )}
      </>}
      {finishedArtwork && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm font-semibold">Actual campaign logo</p>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo applied to this campaign"
              className="max-h-24 rounded-lg bg-white p-3" />
          ) : (
            <p className="text-sm">No saved logo is available. Upload the correct logo below.</p>
          )}
          <label className="block text-sm">
            Replace with the correct brand logo (PNG, up to 5 MB)
            <input type="file" accept="image/png" className={field}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setBrandChecked(false);
                onPreviewReady?.("");
                if (!file) return;
                if (file.type !== "image/png" || file.size > 5 * 1024 * 1024) {
                  setMessage("Choose a PNG logo up to 5 MB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setLogo(String(reader.result));
                reader.onerror = () => setMessage("Unable to read logo.");
                reader.readAsDataURL(file);
              }} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={brandChecked} disabled={!logo}
              onChange={(event) => setBrandChecked(event.target.checked)} />
            This is the actual logo for this campaign's brand.
          </label>
          <button type="button" disabled={!logo || !brandChecked || savingLogo}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
            onClick={async () => {
              if (!logo || !brandChecked || savingLogo) return;
              setSavingLogo(true);
              try {
                const response = await fetch(logo);
                if (!response.ok) throw new Error("Unable to read selected logo.");
                const blob = await response.blob();
                const form = new FormData();
                form.set("brand", productBrand || brandName);
                form.set("file", blob, "brand-logo.png");
                const result = await saveMarketingBrandLogo(form);
                setMessage(result.message);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to save logo.");
              } finally {
                setSavingLogo(false);
              }
            }}>
            {savingLogo ? "Saving logo..." : "Save logo for this brand"}
          </button>
          <p className="text-xs text-[var(--text-secondary)]">
            Upload and save the actual logo once for this brand. Saving logos does not use AI.
          </p>
        </div>
      )}
      {finishedArtwork && (
        <p className="text-sm text-[var(--text-secondary)]">
          This is complete AI-designed artwork. To change its wording or design,
          revise the campaign request and choose Create new artwork.
          Check the generated lettering carefully.
        </p>
      )}
      <button type="button" onClick={download} disabled={!ready}
        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
        Download finished graphic
      </button>
      <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>
      <p className="text-xs text-[var(--text-secondary)]">
        {finishedArtwork ? "Artwork revisions require a new generation." : "Wording and layout edits do not trigger AI generation."}
        Review all claims before publication. Editor changes are not yet saved.
      </p>
    </div>
  );
}