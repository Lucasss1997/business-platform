"use server";

import OpenAI, { toFile } from "openai";
import { reviewMarketingImage } from "@/lib/marketing-image-review";
import { getMarketingProductPhoto } from "@/app/marketing/products/actions";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ImageResult = {
  success: boolean;
  message: string;
  url?: string;
  requestId?: string;
  integrated?: boolean;
};

export async function generateMarketingImage(form: FormData): Promise<ImageResult> {
  const scene = String(form.get("scene") || "").trim();
  const headline = String(form.get("headline") || "").trim();
  const subtitle = String(form.get("subtitle") || "").trim();
  const completeAdvert = Boolean(headline);
  if (headline.length > 75 || subtitle.length > 120) {
    return { success: false, message: "Shorten the artwork headline or subtitle." };
  }

  if (!scene || scene.length > 1200) {
    return { success: false, message: "Describe the background in 1–1200 characters." };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { success: false, message: "The OpenAI key is not configured." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Please sign in again." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError || !membership?.organisation_id) {
    return { success: false, message: "Unable to verify organisation access." };
  }

  const admin = createAdminClient();
  const { data: bucket, error: bucketError } = await admin.storage
    .getBucket("marketing-images");

  if (bucketError || !bucket || bucket.public) {
    return { success: false, message: "Private marketing image storage is not ready. No generation request was sent." };
  }

  const productId = String(form.get("productId") || "").trim();
  const sector = String(form.get("sector") || "").trim();
  const layoutValue = String(form.get("layout") || "left");
  if (!["left", "right", "wide"].includes(layoutValue)) {
    return { success: false, message: "Unsupported campaign composition." };
  }
  const composition: Record<string, string> = {
    left: "Product lower-right, x=40%-94%, y=44%-86%. Upper-left x=5%-68%, y=8%-40% is quiet typography space.",
    right: "Product lower-left, x=6%-60%, y=44%-86%. Upper-right x=32%-95%, y=8%-40% is quiet typography space.",
    wide: "Product prominently in the lower centre, x=20%-80%, y=45%-86%. Top 35% across the frame is quiet typography space."
  };

  const sectorDirections: Record<string, string> = {
    Construction:
      "UK construction compound. Believable unfinished structures, restrained cranes, clean concrete foreground, credible site organisation.",
    Rail:
      "UK railway maintenance compound. Product safely positioned on a service apron away from rails and clearance zones. Tracks and depot structures provide background context. No moving trains, invented approvals or unsafe placement.",
    Utilities:
      "UK utility infrastructure maintenance compound. Restrained pipework and service buildings in the background, tidy hardstanding foreground. No invented connections, certifications or performance implications.",
    Events:
      "UK temporary outdoor event during preparation. Stage structures and practical warm lighting in the background. Product in a separate technical compound, no crowds or unsafe public access."
  };

  let reference: Awaited<ReturnType<typeof getMarketingProductPhoto>> | null = null;

  if (productId) {
    if (!sectorDirections[sector]) {
      return { success: false, message: "Select a supported industry. No generation request was sent." };
    }
    try {
      reference = await getMarketingProductPhoto(productId);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unable to load approved product photo."
      };
    }
  }

  const existingRequestId = String(form.get("existingRequestId") || "").trim();

  if (existingRequestId) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingRequestId) ||
      !reference || !completeAdvert
    ) return { success: false, message: "Select the original product and campaign before reviewing saved artwork." };

    const organisationId = membership.organisation_id;
    const { data: request, error: requestError } = await admin
      .from("marketing_ai_requests")
      .select("id, status")
      .eq("id", existingRequestId)
      .eq("organisation_id", organisationId)
      .eq("kind", "image")
      .single();

    if (requestError || !request || request.status !== "completed") {
      return { success: false, message: "No completed image request was found in your organisation." };
    }

    const path = `${organisationId}/${existingRequestId}.png`;
    const { data: saved, error: downloadError } = await admin.storage
      .from("marketing-images").download(path);

    if (downloadError || !saved || saved.size > 15 * 1024 * 1024) {
      return { success: false, message: "Unable to load the saved artwork. No image generation was requested." };
    }

    try {
      const review = await reviewMarketingImage({
        organisationId,
        userId: user.id,
        artwork: `data:image/png;base64,${Buffer.from(await saved.arrayBuffer()).toString("base64")}`,
        reference: reference.photo,
        productName: reference.name,
        brand: reference.brand,
        sector,
        headline,
        subtitle,
        scene
      });

      if (!review.pass) {
        return {
          success: false,
          requestId: existingRequestId,
          message: [
            "Saved artwork failed review. No new image was generated.",
            ...review.issues,
            ...review.corrections.map((item) => `Correction: ${item}`)
          ].join(" ")
        };
      }

      const { data: signed, error: signError } = await admin.storage
        .from("marketing-images").createSignedUrl(path, 3600);
      if (signError || !signed) throw new Error("Unable to open the reviewed image.");

      return {
        success: true,
        requestId: existingRequestId,
        url: signed.signedUrl,
        integrated: true,
        message: "Saved artwork passed automated review. No new image was generated. Check the artwork and actual logo before publication."
      };
    } catch (error) {
      return {
        success: false,
        requestId: existingRequestId,
        message: `Saved artwork review failed: ${error instanceof Error ? error.message : "unknown error"} No new image was generated.`
      };
    }
  }

  const requestId = randomUUID();
  const organisationId = membership.organisation_id;
  const { error: reserveError } = await admin.rpc("reserve_marketing_ai", {
    p_request_id: requestId,
    p_organisation_id: organisationId,
    p_user_id: user.id,
    p_kind: "image",
    p_reserved_pence: 30
  });

  if (reserveError) {
    return {
      success: false,
      message: reserveError.message.includes("Monthly AI allowance exceeded")
        ? "Marketing generation is temporarily unavailable. Contact your administrator."
        : "Marketing generation is unavailable. No generation request was sent. Contact your administrator."
    };
  }

  const prompt = reference && completeAdvert ? [
    "Design a finished, exceptionally well art-directed square B2B advertisement.",
    `Advertiser: ${reference.brand}. Selected product: ${reference.name}. Audience sector: ${sector}.`,
    "The attached photograph is the product reference, not a layout template.",
    "Preserve the exact enclosure, proportions, colour, connectors, doors, feet and physical details. Do not invent features, cables or connections.",
    "Existing product markings may remain, but manufacturer phone numbers and websites must not appear.",
    "This is an illustrative advertising scene, not evidence of an actual installation or customer endorsement.",
    "Compose photography, typography, whitespace and brand identity as one coherent campaign.",
    "Do not default to a large product bottom-right, white headline top-left, fenced compound, grey sky and dark footer.",
    "Use the campaign concept to determine the environment, product scale, framing, lighting, palette and typography placement.",
    "Aim for sophisticated commissioned advertising photography: authentic material texture, coherent light, convincing ground contact and perspective, deliberate visual hierarchy.",
    "The headline must be immediately readable at mobile feed size. Keep supporting text secondary and the sales contact clear.",
    "Render ONLY the supplied advertising text, exactly as written. No extra slogans, claims, specifications, statistics or hashtags.",
    `Exact headline: ${headline}`,
    `Exact supporting line: ${subtitle}`,
    `Exact advertiser name: ${reference.brand}`,
    "Exact contact email: sales@mltconsultants.co.uk",
        "Use plain advertiser text only. No stylised logo, emblem, monogram or fabricated brand mark. The real logo is added separately.",
    "Reserve a clean, unlettered bottom-right area x=76%-97%, y=88%-98% for the actual logo overlay. Keep all generated words and the product outside it.",
    "Large industrial equipment belongs in a credible external equipment area, never a normal office or meeting room.",
    "For rail context prefer believable depot architecture or distant rail infrastructure. Avoid visible signal heads and complicated track junctions unless essential. No tracks through buildings, malformed rails or impossible infrastructure.",
    "Use a restrained green brand accent where appropriate, not multiple competing green gradients.",
    "No artificial neon glow, green smoke, floating money, collage clutter, watermark or fake before-and-after.",
    "For rail: keep equipment clear of tracks and operational clearance zones. Do not show it powering signalling or imply rail approval.",
    "Campaign concept follows as creative direction, not permission to override product accuracy or invent claims:",
    scene
  ].join("\n") : [
    "Create a realistic commercial photographic scene.",
    reference
      ? `Preserve the attached exact ${reference.name} product reference.`
      : "Do not depict identifiable product models.",
    sectorDirections[sector] || "",
    composition[layoutValue],
    "No added text, logos, contact details, invented connections or product features.",
    "Use coherent natural lighting, credible perspective and grounded equipment.",
    "Creative direction:", scene
  ].join("\n");
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 180000
    });

    const response = reference
      ? await openai.images.edit({
          model: "gpt-image-2",
          image: await toFile(
            Buffer.from(reference.photo.split(",")[1], "base64"),
            "approved-product.png",
            { type: "image/png" }
          ),
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "high",
          output_format: "png"
        })
      : await openai.images.generate({
          model: "gpt-image-2",
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "high",
          output_format: "png"
        });

    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error("No image returned");

    const bytes = Buffer.from(base64, "base64");
    const objectPath = `${organisationId}/${requestId}.png`;

    const { error: uploadError } = await admin.storage
      .from("marketing-images")
      .upload(objectPath, bytes, {
        contentType: "image/png",
        upsert: false
      });

    if (uploadError) throw new Error("Image storage failed");

    let rejection = "";
    if (reference && completeAdvert) {
      try {
        const review = await reviewMarketingImage({
          organisationId,
          userId: user.id,
          artwork: `data:image/png;base64,${base64}`,
          reference: reference.photo,
          productName: reference.name,
          brand: reference.brand,
          sector,
          headline,
          subtitle,
          scene
        });
        if (!review.pass) {
          rejection = [
            "Artwork failed the image review and was not released.",
            ...review.issues,
            ...review.corrections.map((item) => `Correction: ${item}`)
          ].join(" ");
        }
      } catch (error) {
        rejection = `Artwork saved privately; review failed: ${error instanceof Error ? error.message : "unknown error"}. No automatic retry was made.`;
      }
    }

    const { error: ledgerError } = await admin
      .from("marketing_ai_requests")
      .update({
        status: "completed",
        charged_pence: 30,
        completed_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .eq("organisation_id", organisationId)
      .eq("status", "reserved");

    if (rejection) {
      return {
        success: false,
        requestId,
        message: `${rejection} Generation remains recorded against the budget. Reference: ${requestId}`
      };
    }

    const { data: signed, error: signError } = await admin.storage
      .from("marketing-images")
      .createSignedUrl(objectPath, 3600);

    if (signError || !signed) {
      return {
        success: false,
        requestId,
        message: `Image saved, but preview could not be opened. Do not regenerate. Reference: ${requestId}`
      };
    }

    return {
      success: true,
      url: signed.signedUrl, integrated: !!reference,
      requestId,
      message: ledgerError
        ? "Image saved. Budget recording needs checking by your administrator."
        : "Campaign scene saved and recorded against the marketing budget. Review the product against its reference before publication."
    };
  } catch (error) {
    await admin.from("marketing_ai_requests")
      .update({ status: "uncertain", completed_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("organisation_id", organisationId)
      .eq("status", "reserved");

    const status = error instanceof OpenAI.APIError ? error.status : undefined;

    return {
      success: false,
      requestId,
      message: status === 403
        ? "OpenAI denied image access. Check your project's model access or verification requirements. The attempt has been recorded against the marketing budget."
        : status === 401
          ? "OpenAI rejected the API key. The attempt has been recorded against the marketing budget."
          : status === 429
            ? "OpenAI returned a quota or rate limit error. Check billing and limits. The attempt has been recorded against the marketing budget."
            : `Image generation or saving did not complete. No automatic retry was made. The attempt has been recorded against the marketing budget. Reference: ${requestId}`
    };
  }
}