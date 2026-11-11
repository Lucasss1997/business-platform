"use server";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMarketingProductPhoto } from "@/app/marketing/products/actions";
import { renderInstagridOfferEmail } from "@/lib/instagrid-offer-email";

type OfferInput = {
  campaignId: string;
  revision: number;
  monthly24: string;
  monthly12: string;
  show12: boolean;
  email: string;
  phone: string;
};

function price(value: unknown) {
  if (typeof value !== "string" ||
      !/^\d{1,6}(\.\d{1,2})?$/.test(value)) {
    throw new Error("Check the monthly rental prices.");
  }
  const result = Number(value);
  if (result <= 0 || result > 100000) {
    throw new Error("Check the monthly rental prices.");
  }
  return result;
}

export async function saveInstagridCampaignOffer(input: OfferInput) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Please sign in again.");

    const { data: member, error: memberError } = await supabase
      .from("organisation_members").select("organisation_id,role")
      .eq("user_id", user.id).eq("active", true).maybeSingle();

    if (memberError || !member ||
        !["admin", "user"].includes(member.role)) {
      throw new Error("An active sales or admin account is required.");
    }

    if (!input ||
        typeof input.campaignId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.campaignId) ||
        !Number.isSafeInteger(input.revision) || input.revision < 1 ||
        typeof input.show12 !== "boolean") {
      throw new Error("Refresh and select an available campaign.");
    }

    const p24 = price(input.monthly24);
    const p12 = input.show12 ? price(input.monthly12) : null;

    if (typeof input.email !== "string" ||
        input.email.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
        typeof input.phone !== "string" || input.phone.length > 35) {
      throw new Error("Check the contact email and phone.");
    }

    const email = input.email.trim();
    const phone = input.phone.trim();

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns").select("id,created_by,status,revision")
      .eq("id", input.campaignId)
      .eq("organisation_id", member.organisation_id).maybeSingle();

    if (campaignError || !campaign || campaign.created_by !== user.id) {
      throw new Error("Select one of your own campaigns.");
    }
    if (!["draft", "returned"].includes(campaign.status)) {
      throw new Error("Reopen the campaign as a draft before changing its offer.");
    }
    if (campaign.revision !== input.revision) {
      throw new Error("Campaign changed. Refresh before saving the offer.");
    }

    const key = process.env.MAILCHIMP_API_KEY;
    const server = process.env.MAILCHIMP_SERVER_PREFIX;
    if (!key || !server || !/^us[0-9]+$/.test(server) ||
        !key.endsWith(`-${server}`)) {
      throw new Error("Mailchimp artwork hosting is not configured.");
    }

    const productId = "ce3be559-b908-460a-b1f4-abc8745b7d59";
    const product = await getMarketingProductPhoto(productId);
    const logo = await readFile(
      process.cwd() + "/public/branding/mlt-logo.png"
    );

    const reference = randomUUID();
    const assetIds: number[] = [];

    async function upload(name: string, fileData: string) {
      const response = await fetch(
        `https://${server}.api.mailchimp.com/3.0/file-manager/files`,
        {
          method: "POST", cache: "no-store",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Basic ${Buffer.from(`mltportal:${key}`).toString("base64")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name, file_data: fileData })
        }
      );
      if (!response.ok) {
        throw new Error(`Artwork hosting failed (HTTP ${response.status}). The offer was not saved.`);
      }

      const file = await response.json();
      if (typeof file.full_size_url !== "string" ||
          !file.full_size_url.startsWith("https://")) {
        throw new Error("Mailchimp did not return a usable artwork URL.");
      }
      if (typeof file.id === "number") assetIds.push(file.id);
      return file.full_size_url as string;
    }

    const logoUrl = await upload(
      `MLT-offer-logo-${reference}.png`, logo.toString("base64")
    );
    const photoUrl = await upload(
      `MLT-offer-Instagrid-${reference}.png`,
      product.photo.replace(/^data:image\/png;base64,/, "")
    );

    const { html, plainText } = renderInstagridOfferEmail({
      p24, p12, email, phone, logoUrl, photoUrl, internal: false
    });
    const subject = "Serious power. Simple rental. Instagrid ONE from MLT.";

    // The RPC locks the campaign, checks the revision again and saves atomically.
    const { error } = await supabase.rpc("save_email_campaign_offer", {
      p_campaign_id: campaign.id,
      p_revision: input.revision,
      p_offer: {
        template: "instagrid-one-email-v1",
        product_id: productId,
        monthly24: p24,
        monthly12: p12,
        show12: input.show12,
        contact_email: email,
        contact_phone: phone,
        html,
        plain_text: plainText,
        logo_url: logoUrl,
        photo_url: photoUrl,
        asset_ids: assetIds,
        artwork_reference: reference
      },
      p_subject: subject,
      p_body: plainText,
      p_reply_to: email
    });

    if (error) throw new Error(error.message);

    revalidatePath("/marketing/campaigns");
    revalidatePath(`/marketing/campaigns/${campaign.id}`);
    revalidatePath("/marketing/templates/instagrid-one");

    return {
      ok: true,
      campaignId: campaign.id,
      message: "Offer saved to the campaign. Recipients retained. Submit the saved campaign for approval."
    };
  } catch (error) {
    return {
      ok: false,
      campaignId: "",
      message: error instanceof Error ? error.message : "Unable to save the offer."
    };
  }
}