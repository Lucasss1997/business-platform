"use server";

import { renderInstagridOfferEmail } from "@/lib/instagrid-offer-email";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketingProductPhoto } from "@/app/marketing/products/actions";

type Offer = {
  campaignId: string;
  monthly24: string;
  monthly12: string;
  show12: boolean;
  email: string;
  phone: string;
};


const website = "https://www.mltconsultants.co.uk";

function escape(value: string) {
  return value.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]!));
}

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

const money = (value: number) => new Intl.NumberFormat("en-GB", {
  style: "currency", currency: "GBP",
  minimumFractionDigits: 0, maximumFractionDigits: 2
}).format(value);

export async function sendInstagridEmailTest(input: Offer) {
  let sendAttempted = false;

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Please sign in again.");

    // Recipient comes exclusively from the authenticated account.
    const target = user.email?.trim();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      throw new Error("Your signed-in account needs a valid email address.");
    }

    const { data: member, error: memberError } = await supabase
      .from("organisation_members")
      .select("organisation_id,role")
      .eq("user_id", user.id).eq("active", true).maybeSingle();

    if (memberError || !member || !["admin", "user"].includes(member.role)) {
      throw new Error("An active sales or admin account is required to send previews.");
    }

    if (!input || typeof input.campaignId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(input.campaignId) ||
        typeof input.show12 !== "boolean") {
      throw new Error("Select a campaign to record this test against.");
    }

    const p24 = price(input.monthly24);
    const p12 = input.show12 ? price(input.monthly12) : null;
    if (typeof input.email !== "string" || input.email.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new Error("Enter a valid contact email.");
    }
    if (typeof input.phone !== "string" || input.phone.length > 35) {
      throw new Error("Check the contact phone number.");
    }

    const email = input.email.trim();
    const phone = input.phone.trim();

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns").select("id,name,revision")
      .eq("organisation_id", member.organisation_id)
      .eq("id", input.campaignId).maybeSingle();

    if (campaignError || !campaign) {
      throw new Error("The selected campaign is not available.");
    }

    const key = process.env.MAILCHIMP_API_KEY;
    const server = process.env.MAILCHIMP_SERVER_PREFIX;
    const sender = process.env.MAILCHIMP_FROM_EMAIL;
    const fromName = process.env.MAILCHIMP_FROM_NAME;

    if (!key || !server || !/^us[0-9]+$/.test(server) ||
        !key.endsWith(`-${server}`) || !sender || !fromName ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
      throw new Error("Mailchimp sender settings are missing or invalid.");
    }

    const admin = createAdminClient();
    const { data: recent, error: recentError } = await admin
      .from("email_campaign_audit").select("id")
      .eq("organisation_id", member.organisation_id)
      .eq("action", "mailchimp_test")
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .limit(1);

    if (recentError) throw new Error("Unable to check the recent test history.");
    if (recent?.length) throw new Error("Wait one minute before another test.");

    // Load only approved server-side artwork, never client-supplied images.
    const product = await getMarketingProductPhoto(
      "ce3be559-b908-460a-b1f4-abc8745b7d59"
    );
    const logo = await readFile(
      process.cwd() + "/public/branding/mlt-logo.png"
    );

    const auditId = randomUUID();
    const snapshot = {
      template: "instagrid-one-email-v1",
      monthly24: p24, monthly12: p12,
      show12: input.show12, contact_email: email, contact_phone: phone
    };

    const { error: auditError } = await admin
      .from("email_campaign_audit").insert({
        id: auditId,
        campaign_id: campaign.id,
        organisation_id: member.organisation_id,
        actor_id: user.id,
        action: "mailchimp_test",
        revision: campaign.revision,
        details: { status: "preparing", recipient: target, offer: snapshot }
      });

    if (auditError) throw new Error("Could not record the test. Nothing sent.");

    let providerId = "";
    const assetIds: number[] = [];
    let outcome = "";
    let failed = false;

    async function api(path: string, method: string, body: unknown) {
      const response = await fetch(
        `https://${server}.api.mailchimp.com/3.0/${path}`,
        {
          method, cache: "no-store",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Basic ${Buffer.from(`mltportal:${key}`).toString("base64")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        // Do not expose request headers, API credentials or raw provider bodies.
        throw new Error(`Mailchimp rejected the request (HTTP ${response.status}).`);
      }
      return response.status === 204 ? null : response.json();
    }

    async function upload(name: string, fileData: string) {
      const file = await api("file-manager/files", "POST", {
        name, file_data: fileData
      });
      if (typeof file?.id === "number") assetIds.push(file.id);
      if (typeof file?.full_size_url !== "string" ||
          !file.full_size_url.startsWith("https://")) {
        throw new Error("Mailchimp did not return a usable artwork URL.");
      }
      return file.full_size_url as string;
    }

    try {
      const logoUrl = await upload(
        `MLT-logo-${auditId}.png`, logo.toString("base64")
      );
      const photoUrl = await upload(
        `MLT-Instagrid-ONE-${auditId}.png`,
        product.photo.replace(/^data:image\/png;base64,/, "")
      );

      const { html, plainText } = renderInstagridOfferEmail({ p24, p12, email, phone, logoUrl, photoUrl, internal: true });

      // No audience or recipients property: the provider draft is test-only.
      const created = await api("campaigns", "POST", {
        type: "regular",
        settings: {
          title: `PORTAL OFFER TEST - ${campaign.name} - ${auditId}`.slice(0, 150),
          subject_line: "Serious power. Simple rental. Instagrid ONE from MLT.",
          preview_text: `${money(p24)} + VAT per month. No deposit. No upfront rental payment.`,
          from_name: fromName,
          reply_to: sender
        },
        tracking: { opens: false, html_clicks: false, text_clicks: false }
      });

      if (typeof created?.id !== "string" || !created.id) {
        throw new Error("Mailchimp did not return a campaign reference.");
      }
      providerId = created.id;

      const { error: referenceError } = await admin
        .from("email_campaign_audit")
        .update({ details: {
          status: "prepared", recipient: target, offer: snapshot,
          provider_campaign_id: providerId, asset_ids: assetIds
        } }).eq("id", auditId);
      if (referenceError) throw new Error("Could not record the test reference.");

      await api(`campaigns/${encodeURIComponent(providerId)}/content`, "PUT", {
        html, plain_text: plainText
      });

      sendAttempted = true;
      await api(`campaigns/${encodeURIComponent(providerId)}/actions/test`, "POST", {
        test_emails: [target], send_type: "html"
      });

      outcome = `Mailchimp accepted your branded test to ${target}. Check your inbox and junk folder.`;
    } catch (error) {
      failed = true;
      outcome = error instanceof Error ? error.message : "The email test failed.";
      if (sendAttempted) {
        outcome += " Delivery is uncertain. Check your inbox before retrying.";
      }
    }

    const { error: recordError } = await admin
      .from("email_campaign_audit").update({ details: {
        status: failed ? (sendAttempted ? "unconfirmed" : "failed") : "accepted",
        recipient: target, offer: snapshot,
        provider_campaign_id: providerId || null,
        asset_ids: assetIds, note: outcome
      } }).eq("id", auditId);

    if (recordError) {
      failed = true;
      outcome += " The final result could not be recorded.";
    }

    return { ok: !failed, message: outcome };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to prepare the test."
    };
  }
}