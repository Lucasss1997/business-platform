"use server";

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

const target = "lucas.stephenson@icloud.com";
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

    const { data: member, error: memberError } = await supabase
      .from("organisation_members")
      .select("organisation_id,role")
      .eq("user_id", user.id).eq("active", true).maybeSingle();

    if (memberError || member?.role !== "admin") {
      throw new Error("Organisation admin access is required to send tests.");
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

      const totals = `24-month total: ${money(p24 * 24)} excluding VAT.` +
        (p12 !== null ? ` 12-month total: ${money(p12 * 12)} excluding VAT.` : "");

      const alternative = p12 !== null
        ? `<p style="margin:0;padding:20px 0;font-size:19px;border-top:2px solid #287328">12-month option: <strong>${escape(money(p12))} + VAT / month</strong></p>`
        : "";

      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Instagrid ONE rental - MLT Consultants</title>
</head>
<body style="margin:0;padding:0;background:#e9e7e2;color:#141b17;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">
Instagrid ONE: ${escape(money(p24))} + VAT per month over 24 months. No deposit. No upfront rental payment.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9e7e2">
<tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#f5f3ef">
<tr><td style="padding:24px 28px 8px">
<a href="${website}"><img src="${escape(logoUrl)}" width="100" height="100" alt="MLT Consultants" style="display:block;border:0"></a>
</td></tr>
<tr><td style="padding:12px 28px 20px">
<h1 style="margin:0;font-size:38px;line-height:1.08;font-weight:900;letter-spacing:-1px">SERIOUS POWER.<br>SIMPLE RENTAL.</h1>
<div style="margin-top:20px;width:75px;height:6px;background:#287328"></div>
<h2 style="margin:25px 0 12px;font-size:27px">Instagrid ONE</h2>
<p style="margin:0;color:#287328;font-size:62px;line-height:1.1;font-weight:900">${escape(money(p24))}</p>
<p style="margin:8px 0 0;font-size:21px">+ VAT / month</p>
<p style="margin:8px 0 0;font-size:19px">24-month rental</p>
</td></tr>
<tr><td align="center" style="padding:0 20px">
<a href="${escape("mailto:" + email)}"><img src="${escape(photoUrl)}" width="500" alt="Instagrid ONE portable battery power unit" style="display:block;width:100%;max-width:500px;height:auto;border:0"></a>
</td></tr>
<tr><td style="padding:16px 28px 8px">
<p style="margin:0 0 22px;font-size:24px;line-height:1.3;font-weight:700">No deposit. No upfront<br>rental payment.</p>
<p style="margin:0 0 18px;font-size:17px;line-height:1.6;font-weight:700">3,600 W continuous &nbsp;|&nbsp; 18 kW peak &nbsp;|&nbsp; 20 kg</p>
<p style="margin:0 0 24px;font-size:18px;line-height:1.6">Portable, rechargeable power for your next job. Tell us what you need to power and let's discuss the right setup.</p>
${alternative}
</td></tr>
<tr><td style="padding:28px;background:#141b17;color:#ffffff">
<h2 style="margin:0 0 22px;font-size:25px;line-height:1.2">LET'S TALK PORTABLE POWER.</h2>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="background:#287328;border-radius:4px">
<a href="${escape("mailto:" + email + "?subject=Instagrid%20ONE%20rental%20enquiry")}" style="display:inline-block;padding:15px 21px;color:#ffffff;font-size:17px;font-weight:700;text-decoration:none">Enquire about rental</a>
</td></tr></table>
<p style="margin:24px 0 8px;font-size:16px;line-height:1.6;word-break:break-word"><a href="${escape("mailto:" + email)}" style="color:#ffffff">${escape(email)}</a></p>
${phone ? `<p style="margin:0 0 8px;font-size:16px">${escape(phone)}</p>` : ""}
<p style="margin:0 0 22px;font-size:16px"><a href="${website}" style="color:#ffffff">mltconsultants.co.uk</a></p>
<p style="margin:0 0 10px;font-size:12px;line-height:1.6">Rentals exclude VAT. Unit returned at the end of the agreed term. Warranty cover subject to applicable terms and exclusions. Full rental terms supplied with your quotation.</p>
<p style="margin:0;font-size:12px;line-height:1.6">${escape(totals)}</p>
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;line-height:1.6;color:#526052">
Internal preview for Lucas only. No customer audience selected. This test does not send or approve your saved customer campaign.
</td></tr>
</table>
</td></tr></table>
</body></html>`;

      const plainText = [
        "MLT Consultants", "", "SERIOUS POWER. SIMPLE RENTAL.", "",
        "Instagrid ONE",
        `${money(p24)} + VAT per month. 24-month rental.`,
        "No deposit. No upfront rental payment.", "",
        "3,600 W continuous. 18 kW peak. 20 kg.",
        "Portable, rechargeable power for your next job.", "",
        ...(p12 !== null ? [`12-month option: ${money(p12)} + VAT per month.`, ""] : []),
        "Tell us what you need to power and let's discuss the right setup.",
        email, ...(phone ? [phone] : []), website, "",
        "Rentals exclude VAT. Unit returned at the end of the agreed term.",
        "Warranty cover subject to applicable terms and exclusions.",
        "Full rental terms supplied with your quotation.",
        totals, "", "Internal preview for Lucas only."
      ].join("\n");

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