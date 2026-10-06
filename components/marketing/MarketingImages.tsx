"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { generateMarketingImage } from "@/app/marketing/image-actions";
import CampaignLoading from "@/components/marketing/CampaignLoading";
import MarketingGraphicEditor from "@/components/marketing/MarketingGraphicEditor";

import Link from "next/link";
import { getMarketingProductPhoto } from "@/app/marketing/products/actions";
import { getMarketingProducts } from "@/app/marketing/product-actions";

type Product = Awaited<ReturnType<typeof getMarketingProducts>>[number];

const productGroups = [
  "Compact batteries",
  "Mid-range batteries",
  "Large batteries",
  "Power base systems",
  "Accessories"
];

const industries = {
  Construction: {
    settings: ["Active construction site", "Site cabins", "Urban development"],
    scenes: [
      "A modern UK construction site with cranes and unfinished buildings in the distance.",
      "A tidy UK construction compound with site cabins and temporary access roads.",
      "An urban UK redevelopment project with scaffolding and construction activity in the distance."
    ]
  },
  Rail: {
    settings: ["Track maintenance", "Rail depot", "Station works"],
    scenes: [
      "A UK railway maintenance worksite with tracks receding into the distance, no moving trains.",
      "A modern UK rail maintenance depot with industrial buildings and tracks in the distance.",
      "A UK railway station improvement worksite, viewed from a safely separated construction area."
    ]
  },
  Utilities: {
    settings: ["Water infrastructure", "Utility maintenance", "Remote infrastructure"],
    scenes: [
      "A UK water infrastructure worksite with pipework and industrial facilities in the distance.",
      "A tidy UK utility maintenance compound with equipment and service vehicles in the distance.",
      "A remote UK infrastructure site with practical access roads and restrained industrial detail."
    ]
  },
  Events: {
    settings: ["Outdoor event setup", "Festival preparation", "Temporary venue"],
    scenes: [
      "A UK outdoor event being prepared, with stage structures and lighting rigs in the distance.",
      "A UK festival site before opening, with staging and marquees in the distance.",
      "A professionally organised temporary outdoor venue with structures and lighting equipment."
    ]
  }
};

type Industry = keyof typeof industries;

const purposes = [
  "Standard business promo",
  "Social post",
  "Promote the battery range",
  "Invite project enquiries",
  "Industry news response",
  "Case study"
];

const styles = {
  "Professional daylight": "Natural daylight, realistic restrained colours and crisp photographic detail.",
  "Warm dawn": "Early morning light, warm amber highlights and restrained navy shadows.",
  "Evening atmosphere": "Soft evening light, subtle worksite lighting and deep navy tones."
};

type Style = keyof typeof styles;

const fieldClass =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--text-primary)]";

export default function MarketingImages() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productError, setProductError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMarketingProducts()
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
          setProductsLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProductError(error instanceof Error ? error.message : "Unable to load products.");
        }
      });
    return () => { cancelled = true; };
  }, []);

  const [industry, setIndustry] = useState<Industry>("Construction");
  const [setting, setSetting] = useState(0);
  const [purpose, setPurpose] = useState(purposes[0]);
  const [style, setStyle] = useState<Style>("Warm dawn");
  const [extra, setExtra] = useState("");
  const [customBrief, setCustomBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [url, setUrl] = useState("");
  const [integrated, setIntegrated] = useState(false);
  const [graphicSector, setGraphicSector] = useState("Construction");
  const [graphicProduct, setGraphicProduct] = useState({ photo: "", name: "", brand: "" });
  const [message, setMessage] = useState("");

  const selectedProduct = products.find((product) => `product:${product.id}` === purpose);

  const suggestedBrief = [
    industries[industry].scenes[setting],
    styles[style],
    "Professional B2B advertising composition for LinkedIn, square format.",
    "Use a spacious clean foreground and a clear focal hierarchy.",
    "Keep the upper left quiet for a headline. Make the referenced product the lower-right focal point.",
    "Avoid prominent people, identifiable brands and distracting clutter.",
        selectedProduct
      ? `Campaign direction: product spotlight for ${selectedProduct.name}, marketed by ${selectedProduct.brand}. Use the supplied approved product reference and retain the exact model.`
      : `Campaign direction: ${purpose.toLowerCase()}.`,
    extra.trim() ? `Additional visual preferences: ${extra.trim()}` : ""
  ].filter(Boolean).join("\n");

  const imageBrief = customBrief ?? suggestedBrief;

  function resetCustomBrief() {
    setCustomBrief(null);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!imageBrief.trim() || imageBrief.length > 1200) {
      setMessage("Keep the image brief between 1 and 1200 characters.");
      return;
    }


    if (purpose === "Industry news response" || purpose === "Case study") {
      setMessage("This campaign needs verified source material first. No generation request was sent.");
      return;
    }

    const form = new FormData();
    form.set("scene", imageBrief);
    form.set("sector", industry);
    if (selectedProduct) form.set("productId", selectedProduct.id);

    setBusy(true);
    setMessage("Creating a high-quality campaign scene from the approved reference. This can take a few minutes.");

    try {
      setGenerationStage("Checking the selected product and loading its approved photograph...");
      const asset = selectedProduct
        ? await getMarketingProductPhoto(selectedProduct.id)
        : { photo: "", name: "", brand: "" };

      setGenerationStage("Creating the campaign scene and matching the product to its surroundings...");
      const result = await generateMarketingImage(form);
      if (result.success && result.url) {
        setGenerationStage("Preparing the finished preview...");
        setGraphicProduct(asset);
        setIntegrated(Boolean(result.integrated));
        setGraphicSector(industry);
        setUrl(result.url);
      }
      setMessage(result.success
        ? "Campaign scene saved. Compare the equipment with the reference, then review the wording."
        : result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request was interrupted. Contact your administrator before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Create a marketing graphic</h2>
        <Link href="/marketing/products" className="text-sm font-semibold underline">
          Manage product photographs
        </Link>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Choose your audience and campaign direction. We build the detailed image brief for you.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <form onSubmit={generate} className="space-y-5">
          {productError && <p role="alert" className="text-sm">{productError}</p>}
          {!productError && !productsLoaded && <p className="text-sm">Loading product catalogue...</p>}
          {productsLoaded && products.length === 0 && (
            <p className="rounded-xl border border-[var(--border)] p-3 text-sm">
              No marketing products have been imported yet. General campaigns are available below.
            </p>
          )}
          {selectedProduct && (
            <p className="rounded-xl border border-[var(--border)] p-3 text-sm">
              {selectedProduct.name}: {selectedProduct.photoReady
                ? "Approved photograph registered."
                : "An approved product photograph is still required."}
            </p>
          )}
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Industry
                <select value={industry} className={fieldClass}
                  onChange={(event) => {
                    setIndustry(event.target.value as Industry);
                    setSetting(0);
                    resetCustomBrief();
                  }}>
                  {(Object.keys(industries) as Industry[]).map((item) =>
                    <option key={item}>{item}</option>
                  )}
                </select>
              </label>

              <label className="block text-sm font-medium">
                What do you want to promote?
                <select value={purpose} className={fieldClass}
                  onChange={(event) => {
                    setPurpose(event.target.value);
                    resetCustomBrief();
                  }}>
                  {productGroups.map((group) => {
                    const items = products
                      .filter((product) => product.group === group)
                      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "en", { numeric: true }));
                    return items.length ? (
                      <optgroup key={group} label={group}>
                        {items.map((product) => (
                          <option key={product.id} value={`product:${product.id}`}>
                            {product.name}{product.photoReady ? "" : " — photo pending"}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                  <optgroup label="General campaigns">
                    {purposes.map((item) => <option key={item}>{item}</option>)}
                  </optgroup>
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium">
              Suggested setting
              <select value={setting} className={fieldClass}
                onChange={(event) => {
                  setSetting(Number(event.target.value));
                  resetCustomBrief();
                }}>
                {industries[industry].settings.map((item, index) =>
                  <option key={item} value={index}>{item}</option>
                )}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Visual style
              <select value={style} className={fieldClass}
                onChange={(event) => {
                  setStyle(event.target.value as Style);
                  resetCustomBrief();
                }}>
                {(Object.keys(styles) as Style[]).map((item) =>
                  <option key={item}>{item}</option>
                )}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Anything else? (optional)
              <input value={extra} maxLength={150} className={fieldClass}
                onChange={(event) => {
                  setExtra(event.target.value);
                  resetCustomBrief();
                }}
                placeholder="e.g. Keep the scene bright and uncluttered" />
            </label>

            <details className="rounded-xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Adjust the image brief (optional)
              </summary>
              <p className="mt-3 text-xs text-[var(--text-secondary)]">
                This is prepared automatically. Changing a guided choice rebuilds it.
              </p>
              <label className="sr-only" htmlFor="marketing-image-brief">
                Detailed image brief
              </label>
              <textarea id="marketing-image-brief"
                value={imageBrief} maxLength={1200} rows={8}
                onChange={(event) => setCustomBrief(event.target.value)}
                className={fieldClass} />
              <button type="button" onClick={resetCustomBrief}
                className="mt-3 text-sm font-semibold underline">
                Restore suggested brief
              </button>
            </details>

            <p className="text-xs text-[var(--text-secondary)]">
              This generation will be recorded against your organisation&apos;s marketing budget.
            </p>

            <button type="submit"
              className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Generating..." : "Generate & allocate to marketing budget"}
            </button>
          </fieldset>

          <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>
        </form>

        <div className="space-y-3" aria-busy={busy}>
          {busy && (
            <CampaignLoading stage={generationStage || "Preparing your campaign..."} />
          )}
          {url ? (
            <>
              <MarketingGraphicEditor
                key={url}
                backgroundUrl={url}
                integrated={integrated}
                sector={graphicSector}
                initialProduct={graphicProduct.photo}
                productName={graphicProduct.name}
                productBrand={graphicProduct.brand}
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Edit the product photograph, branding and headline
                in the graphic editor above.
              </p>
            </>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-secondary)]">
              Choose your campaign settings to create the background.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}