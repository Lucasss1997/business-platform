"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { MarketingCampaign } from "@/lib/marketing-campaign";
import { generateMarketingDraft } from "@/app/marketing/actions";
import { generateMarketingImage } from "@/app/marketing/image-actions";
import { getMarketingProducts } from "@/app/marketing/product-actions";
import { getMarketingProductPhoto } from "@/app/marketing/products/actions";
import { retrieveMarketingArticle } from "@/app/marketing/news-actions";
import type { ArticleResult } from "@/app/marketing/news-actions";
import CampaignLoading from "./CampaignLoading";
import MarketingGraphicEditor from "./MarketingGraphicEditor";

type Product = Awaited<ReturnType<typeof getMarketingProducts>>[number];
type Asset = Awaited<ReturnType<typeof getMarketingProductPhoto>>;
const groups = ["Compact batteries", "Mid-range batteries", "Large batteries", "Power base systems", "Accessories"];
const field = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm";
const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5";

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
  );
}

export default function MarketingClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [sector, setSector] = useState("Construction");
  const [format, setFormat] = useState("LinkedIn post");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [integrated, setIntegrated] = useState(false);
  const [artworkLayout, setArtworkLayout] = useState<"left" | "right" | "wide">("left");
  const recentDirections = useRef<string[]>([]);
  const [finishedImage, setFinishedImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [notice, setNotice] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: string; text: string }>>([]);
  const product = products.find((item) => item.id === productId);

  useEffect(() => {
    let cancelled = false;
    getMarketingProducts().then((items) => {
      if (!cancelled) setProducts(items);
    }).catch((error: unknown) => {
      if (!cancelled) setNotice(error instanceof Error ? error.message : "Unable to load products.");
    });
    return () => { cancelled = true; };
  }, []);

  async function loadArticle() {
    if (busy || !articleUrl.trim()) return;
    setBusy(true);
    setStage("Retrieving article context and checking source citations...");
    setArticle(null);
    setNotice("");
    try {
      const result = await retrieveMarketingArticle(articleUrl);
      setNotice(result.message);
      if (result.success && result.context) {
        setArticle(result);
        setSource(result.context);
      }
    } catch {
      setNotice("Article retrieval was interrupted. No automatic retry was made.");
    } finally {
      setBusy(false);
    }
  }

  async function makeArtwork(plan: MarketingCampaign, existingRequestId = "") {
    const form = new FormData();
    form.set("productId", productId);
    if (existingRequestId) form.set("existingRequestId", existingRequestId);

    form.set("sector", sector);
    form.set("scene", plan.imageBrief);
    form.set("headline", plan.headline);
    form.set("subtitle", plan.subtitle);
    form.set("layout", plan.layout || "left");
    setStage(existingRequestId
      ? "Reviewing the saved artwork. No new image is being generated..."
      : "Creating artwork, then checking realism, product accuracy and lettering...");
    const result = await generateMarketingImage(form);
    if (!result.success || !result.url) throw new Error(result.message);
    setImageUrl(result.url);
    setArtworkLayout(plan.layout || "left");
    recentDirections.current = [
      ...recentDirections.current,
      `${plan.headline} | ${plan.layout} | ${plan.imageBrief}`
    ].slice(-3);
    setIntegrated(Boolean(result.integrated));
    setFinishedImage("");
    setNotice(result.message);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!product?.photoReady || !message.trim()) {
      setNotice("Choose a product with an approved photo and enter a headline or idea.");
      return;
    }

    const request = message.trim();
    setBusy(true);
    setNotice("");
    setConversation((items) => [...items, { role: "You", text: request }]);
    setStage("Loading the approved product and campaign context...");

    try {
      const selectedAsset = await getMarketingProductPhoto(productId);
      setAsset(selectedAsset);
      const form = new FormData();
      form.set("campaignMode", "true");
      form.set("productId", productId);

      form.set("brand", product.brand);
      form.set("format", format);
      form.set("audience", `${sector} purchasing and project managers`);
      form.set("tone", "Professional and conversational");
      form.set("brief", request);
      form.set("action", "Discuss your project requirements: sales@mltconsultants.co.uk");
      form.set("sourceText", source);
      form.set("creativeHistory", recentDirections.current.join("\n").slice(-3000));
      if (campaign) form.set("previousCampaign", JSON.stringify(campaign));

      setStage("Developing the campaign angle, public copy and visual direction...");
      const result = await generateMarketingDraft(form);
      if (!result.success || !result.campaign) throw new Error(result.message);

      const firstCampaign = !campaign;
      setCampaign(result.campaign);
      setConversation((items) => [
        ...items, { role: "Campaign assistant", text: result.campaign!.summary }
      ]);
      setMessage("");
      setNotice(result.message);

      if (firstCampaign) {
        await makeArtwork(result.campaign);
      } else {
        setNotice("Copy revised. Existing artwork retained. Use Create new artwork if the visual direction also needs changing.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Request interrupted. No automatic retry was made.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateArtwork() {
    if (!campaign || busy) return;
    setBusy(true);
    try { await makeArtwork(campaign); }
    catch (error) {
      setNotice(error instanceof Error ? error.message : "Artwork creation failed.");
    } finally { setBusy(false); }
  }

  async function copyPublicText() {
    if (!campaign) return;
    const text = format === "Sales email"
      ? `Subject: ${campaign.subject}\nPreview: ${campaign.preheader}\n\n${campaign.body}`
      : campaign.body;
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Public copy copied.");
    } catch {
      const textarea = document.getElementById("campaign-body");
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
        textarea.select();
      }
      setNotice("Copy the selected body with Ctrl+C.");
    }
  }

  function downloadMailer() {
    if (!campaign || !finishedImage) return;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(campaign.subject)}</title></head><body style="margin:0;background:#edf1f4;font-family:Arial,sans-serif;color:#102436"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(campaign.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff"><tr><td><img src="${finishedImage}" alt="${escapeHtml(campaign.headline)}" width="600" style="display:block;width:100%;height:auto"></td></tr><tr><td style="padding:30px;font-size:17px;line-height:1.65">${escapeHtml(campaign.body).replace(/\n/g, "<br>")}</td></tr><tr><td style="padding:0 30px 30px"><a href="mailto:sales@mltconsultants.co.uk" style="display:inline-block;background:#102436;color:#fff;text-decoration:none;padding:14px 22px">Discuss your requirements</a></td></tr></table></td></tr></table></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "marketing-email-preview.html";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/marketing/knowledge" className="underline">Approved information</Link>
        <Link href="/marketing/products" className="underline">Product photographs</Link>
      </div>

      {campaign && (
        <div className={`${panel} space-y-2`}>
          <button type="button" disabled={busy}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
            onClick={async () => {
              const id = window.prompt(
                "Use the original campaign and product. Enter the saved image reference. This runs one paid review only; it does not generate another image.",
                "0bf47380-f4fb-4627-8cf8-18362d95737c"
              );
              if (!id?.trim() || busy) return;
              setBusy(true);
              try {
                await makeArtwork(campaign, id.trim());
              } catch (error) {
                setNotice(error instanceof Error ? error.message : "Saved artwork review failed.");
              } finally {
                setBusy(false);
              }
            }}>
            Review saved artwork (5p allocation)
          </button>
          <p className="text-xs text-[var(--text-secondary)]">
            Recovery checks the saved image against the current campaign.
            Keep the original headline, product and campaign selected.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className={`${panel} space-y-5`}>
          <h2 className="text-xl font-semibold">Campaign assistant</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Give us a headline, an idea or an article. We develop the campaign around it.
          </p>

          <fieldset disabled={busy || !!campaign} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Sector
              <select className={field} value={sector} onChange={(e) => setSector(e.target.value)}>
                {["Construction", "Rail", "Utilities", "Events"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Channel
              <select className={field} value={format} onChange={(e) => setFormat(e.target.value)}>
                <option>LinkedIn post</option><option>Sales email</option>
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Featured product
              <select className={field} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Choose a product</option>
                {groups.map((group) => (
                  <optgroup key={group} label={group}>
                    {products.filter((item) => item.group === group)
                      .sort((a, b) => a.order - b.order)
                      .map((item) => <option key={item.id} value={item.id} disabled={!item.photoReady}>
                        {item.name}{item.photoReady ? "" : " - photo pending"}
                      </option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </fieldset>

          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <label className="block text-sm font-medium">
              News article URL
              <input type="url" className={field} value={articleUrl}
                disabled={busy} maxLength={2000}
                onChange={(e) => { setArticleUrl(e.target.value); setArticle(null); }}
                placeholder="https://publisher.com/article" />
            </label>
            <button type="button" disabled={busy || !articleUrl.trim()}
              onClick={() => void loadArticle()}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-40">
              Retrieve article context
            </button>
            <p className="text-xs text-[var(--text-secondary)]">
              Retrieval is recorded against the marketing budget.
              A retrieved report is source material, not independent verification.
            </p>
            {article?.parts && (
              <div className="whitespace-pre-wrap rounded-xl bg-[var(--surface-muted)] p-4 text-sm leading-6">
                {article.parts.map((part, index) => part.url
                  ? <a key={index} href={part.url} target="_blank" rel="noopener noreferrer"
                      className="font-semibold underline">{part.text}</a>
                  : <span key={index}>{part.text}</span>)}
              </div>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">Paste article or source material</summary>
            <textarea aria-label="Article or source material" className={field} rows={7}
              value={source} maxLength={6000} disabled={busy}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Paste the relevant article text, with its title, publisher, date and URL where available. Use the URL field above to retrieve article context, or paste text here." />
          </details>

          <div className="space-y-3">
            {conversation.map((entry, index) => (
              <div key={index} className={`rounded-xl p-4 text-sm ${entry.role === "You" ? "bg-blue-600/10" : "bg-[var(--surface-muted)]"}`}>
                <p className="mb-1 font-semibold">{entry.role}</p>
                <p className="whitespace-pre-wrap">{entry.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="space-y-3">
            <textarea aria-label="Message to campaign assistant" className={field}
              rows={4} value={message} maxLength={1500} required disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={campaign
                ? "e.g. Make the headline sharper and focus the post on purchasing managers."
                : "e.g. Are fuel costs eating into your site budget? Build a construction campaign around reviewing battery power options."} />
            <button type="submit" disabled={busy || !product?.photoReady}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Working..." : campaign ? "Send copy revision" : "Create campaign and artwork"}
            </button>
          </form>

          {busy && <CampaignLoading stage={stage} />}
          <p role="status" className="text-sm">{notice}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Generations are recorded against the marketing budget.
            Follow-up messages revise copy; new artwork is generated only when requested.
          </p>
          {campaign && <button type="button" disabled={busy}
            className="text-sm font-semibold underline"
            onClick={() => {
              setCampaign(null); setAsset(null); setImageUrl("");
              setFinishedImage(""); setConversation([]); setNotice("");
            }}>Start a new campaign</button>}
        </section>

        <section className="space-y-5">
          {campaign && (
            <div className={`${panel} space-y-4`}>
              <h2 className="text-lg font-semibold">{format === "Sales email" ? "Email campaign" : "LinkedIn campaign"}</h2>
              {format === "Sales email" && <>
                <label className="block text-sm">Subject
                  <input className={field} value={campaign.subject}
                    onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })} />
                </label>
                <label className="block text-sm">Preview text
                  <input className={field} value={campaign.preheader}
                    onChange={(e) => setCampaign({ ...campaign, preheader: e.target.value })} />
                </label>
              </>}
              <label className="block text-sm">Public copy
                <textarea id="campaign-body" className={field} rows={12} value={campaign.body}
                  onChange={(e) => setCampaign({ ...campaign, body: e.target.value })} />
              </label>
              <button type="button" onClick={() => void copyPublicText()}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                Copy public text
              </button>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Review notes</summary>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                  {campaign.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}
                </ul>
              </details>
              <button type="button" disabled={busy} onClick={() => void regenerateArtwork()}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-40">
                {imageUrl ? "Create new artwork" : "Create artwork from this campaign"}
              </button>
            </div>
          )}

          {imageUrl && asset && campaign && (
            <div className={panel}>
              <MarketingGraphicEditor
                key={`${imageUrl}:${campaign.headline}:${campaign.subtitle}`}
                backgroundUrl={imageUrl}
                initialProduct={asset.photo}
                productName={asset.name}
                productBrand={asset.brand}
                integrated={integrated}
                finishedArtwork={integrated}
                layout={artworkLayout}
                sector={sector}
                initialHeadline={campaign.headline}
                initialSupport={campaign.subtitle}
                onPreviewReady={setFinishedImage}
              />
              {format === "Sales email" && <>
                <button type="button" disabled={!finishedImage} onClick={downloadMailer}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
                  Download email preview
                </button>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  HTML preview for review. Sending integration and production email image hosting are not connected yet.
                </p>
              </>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}