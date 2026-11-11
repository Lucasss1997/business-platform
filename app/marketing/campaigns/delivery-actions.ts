"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ObjectValue = Record<string, unknown>;

export type DeliveryReport = {
  ok: boolean;
  message: string;
  total?: number;
  subscribed?: number;
  blocked?: string[];
  canPrepare?: boolean;
  canSend?: boolean;
  deliveryStatus?: string;
  providerId?: string;
  previewHtml?: string;
  sender?: string;
  emailsSent?: number;
};

type Request = {
  campaignId: string;
  revision: number;
  operation: "check" | "prepare" | "send" | "refresh";
  confirmed?: boolean;
};

function object(value: unknown): ObjectValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ObjectValue : {};
}
function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
function rows(value: unknown): ObjectValue[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function escape(value: string) {
  return value.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]!));
}
function fingerprint(value: ObjectValue) {
  return createHash("sha256")
    .update(JSON.stringify([text(value.html), text(value.plain_text)]))
    .digest("hex");
}
function addressList(value: unknown) {
  const result = rows(value).map(row => text(row.email).trim().toLowerCase());
  if (!result.length || result.some(email =>
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) || new Set(result).size !== result.length) {
    throw new Error("The saved recipient list needs checking.");
  }
  return result.sort();
}
function sameAddresses(a: string[], b: string[]) {
  return a.length === b.length &&
    [...a].sort().every((email, index) => email === [...b].sort()[index]);
}

export async function manageCampaignDelivery(input: Request): Promise<DeliveryReport> {
  let claimedId = "";
  let sendRequested = false;
  let sendAccepted = false;

  const admin = createAdminClient();

  try {
    if (!input ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.campaignId) ||
        !Number.isSafeInteger(input.revision) || input.revision < 1 ||
        !["check", "prepare", "send", "refresh"].includes(input.operation)) {
      throw new Error("Refresh the campaign and try again.");
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Please sign in again.");
    const actorId = user.id;

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns").select("*")
      .eq("id", input.campaignId).maybeSingle();
    if (campaignError || !campaign) throw new Error("Campaign unavailable.");

    const { data: member, error: memberError } = await supabase
      .from("organisation_members").select("role")
      .eq("organisation_id", campaign.organisation_id)
      .eq("user_id", user.id).eq("active", true).maybeSingle();

    if (memberError || member?.role !== "admin") {
      throw new Error("Organisation admin access is required.");
    }
    if (campaign.revision !== input.revision) {
      throw new Error("The campaign revision changed. Refresh before continuing.");
    }

    const key = process.env.MAILCHIMP_API_KEY;
    const server = process.env.MAILCHIMP_SERVER_PREFIX;
    const audience = process.env.MAILCHIMP_AUDIENCE_ID;
    const fromEmail = process.env.MAILCHIMP_FROM_EMAIL;
    const fromName = process.env.MAILCHIMP_FROM_NAME;

    if (!key || !server || !/^us[0-9]+$/.test(server) ||
        !key.endsWith(`-${server}`) ||
        !audience || !/^[a-z0-9]+$/i.test(audience) ||
        !fromEmail || !fromName ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      throw new Error("Mailchimp environment settings are missing or invalid.");
    }

    async function api(path: string, method = "GET", body?: unknown) {
      const response = await fetch(
        `https://${server}.api.mailchimp.com/3.0/${path}`,
        {
          method, cache: "no-store",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Basic ${Buffer.from(`mltportal:${key}`).toString("base64")}`,
            "Content-Type": "application/json"
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) })
        }
      );
      if (!response.ok) {
        throw new Error(`Mailchimp request failed (HTTP ${response.status}).`);
      }
      return response.status === 204 ? {} : object(await response.json());
    }

    async function members(path: string) {
      const output: ObjectValue[] = [];
      for (let offset = 0; offset < 25000; offset += 1000) {
        const separator = path.includes("?") ? "&" : "?";
        const page = await api(`${path}${separator}count=1000&offset=${offset}`);
        if (!Array.isArray(page.members) ||
            typeof page.total_items !== "number") {
          throw new Error("Mailchimp returned an incomplete recipient list.");
        }
        const batch = rows(page.members);
        output.push(...batch);
        if (output.length >= page.total_items) return output;
        if (!batch.length) throw new Error("Mailchimp recipient paging was incomplete.");
      }
      throw new Error("This audience needs a larger-list sending configuration.");
    }

    async function delivery() {
      const { data, error } = await admin
        .from("email_campaign_deliveries").select("*")
        .eq("campaign_id", campaign.id)
        .eq("organisation_id", campaign.organisation_id)
        .eq("revision", campaign.revision).maybeSingle();
      if (error) throw new Error("Unable to read the delivery record.");
      return data;
    }

    async function updateDelivery(id: string, values: ObjectValue) {
      const { data, error } = await admin
        .from("email_campaign_deliveries")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organisation_id", campaign.organisation_id)
        .select("id").single();
      if (error || !data) throw new Error("Unable to record the delivery result.");
    }

    async function audit(action: string, details: ObjectValue) {
      const { error } = await admin.from("email_campaign_audit").insert({
        campaign_id: campaign.id,
        organisation_id: campaign.organisation_id,
        actor_id: actorId,
        action,
        revision: campaign.revision,
        details
      });
      return !error;
    }

    function view(job: NonNullable<Awaited<ReturnType<typeof delivery>>>): DeliveryReport {
      const result = object(job.result);
      const payload = object(job.payload);
      return {
        ok: true,
        message: text(result.note) || `Delivery record: ${job.status.replaceAll("_", " ")}.`,
        total: Number(payload.recipient_count),
        deliveryStatus: job.status,
        providerId: job.provider_campaign_id || undefined,
        previewHtml: text(payload.final_html) || undefined,
        sender: text(payload.from_email) || undefined,
        emailsSent: typeof result.emails_sent === "number" ? result.emails_sent : undefined,
        canSend: job.status === "prepared" && result.checklist_ready === true
      };
    }

    function approved() {
      if (!["approved", "sending"].includes(campaign.status) ||
          campaign.approved_revision !== campaign.revision ||
          campaign.submitted_revision !== campaign.revision) {
        throw new Error("This exact campaign revision must be approved.");
      }
      const offer = object(campaign.flyer_snapshot);
      if (offer.template !== "instagrid-one-email-v1" ||
          !text(offer.html) ||
          offer.plain_text !== campaign.email_body ||
          offer.contact_email !== campaign.reply_to) {
        throw new Error("The saved rental offer needs checking and approval.");
      }
      if (campaign.reply_to.trim().toLowerCase() !== fromEmail!.trim().toLowerCase()) {
        throw new Error(
          `For this sender configuration, save the offer with contact email ${fromEmail}, then approve it again.`
        );
      }
      return offer;
    }

    async function checkRecipients(expected: string[]) {
      const subscribedRows = await members(
        `lists/${encodeURIComponent(audience!)}/members?status=subscribed&fields=members.email_address,members.status,total_items`
      );
      const subscribed = new Set(subscribedRows
        .filter(row => row.status === "subscribed")
        .map(row => text(row.email_address).trim().toLowerCase()));
      return expected.filter(email => !subscribed.has(email));
    }

    async function checklist(providerId: string) {
      const check = await api(`campaigns/${encodeURIComponent(providerId)}/send-checklist`);
      const issues = rows(check.items)
        .filter(item => item.type !== "success")
        .map(item => text(item.heading).replace(/<[^>]*>/g, "").slice(0, 200))
        .filter(Boolean);
      return {
        ready: check.is_ready === true,
        note: issues.join(" ").slice(0, 1200)
      };
    }

    async function verifyPrepared(job: NonNullable<Awaited<ReturnType<typeof delivery>>>) {
      const payload = object(job.payload);
      const expected = addressList(payload.recipients);
      if (payload.audience_id !== audience ||
          payload.from_email !== fromEmail ||
          payload.from_name !== fromName) {
        throw new Error("The sender or audience settings changed after preparation.");
      }
      const blocked = await checkRecipients(expected);
      if (blocked.length) {
        throw new Error(`${blocked.length} recipient(s) are no longer subscribed. Nothing sent by this action.`);
      }

      const providerId = text(job.provider_campaign_id);
      if (!providerId) throw new Error("The Mailchimp campaign reference is missing.");

      const info = await api(`campaigns/${encodeURIComponent(providerId)}`);
      const recipients = object(info.recipients);
      const segment = object(recipients.segment_opts);
      const settings = object(info.settings);
      if (info.status !== "save" ||
          recipients.list_id !== audience ||
          segment.saved_segment_id !== payload.segment_id ||
          recipients.recipient_count !== expected.length ||
          settings.subject_line !== payload.subject ||
          settings.from_name !== payload.from_name ||
          text(settings.reply_to).toLowerCase() !== text(payload.from_email).toLowerCase()) {
        throw new Error("The Mailchimp draft no longer matches the prepared Portal campaign.");
      }

      const segmentRows = await members(
        `lists/${encodeURIComponent(audience!)}/segments/${Number(payload.segment_id)}/members`
      );
      const segmentEmails = segmentRows.map(row =>
        text(row.email_address).trim().toLowerCase()
      );
      if (!sameAddresses(expected, segmentEmails)) {
        throw new Error("The Mailchimp segment no longer matches the approved recipient list.");
      }

      const content = await api(`campaigns/${encodeURIComponent(providerId)}/content`);
      if (fingerprint(content) !== payload.content_hash) {
        throw new Error("The Mailchimp email content changed after preparation.");
      }
      const check = await checklist(providerId);
      if (!check.ready) {
        throw new Error(`Mailchimp is not ready to send. ${check.note}`);
      }
      return providerId;
    }

    const existing = await delivery();

    if (input.operation === "refresh") {
      if (!existing) return {
        ok: true, message: "No delivery has been prepared. Check recipients first."
      };
      if (!existing.provider_campaign_id) return view(existing);

      const info = await api(
        `campaigns/${encodeURIComponent(existing.provider_campaign_id)}`
      );
      const previousResult = object(existing.result);
      const currentPayload = object(existing.payload);

      if (info.status === "sent" || info.status === "sending") {
        await updateDelivery(existing.id, {
          status: "accepted",
          result: {
            ...previousResult,
            provider_status: info.status,
            emails_sent: typeof info.emails_sent === "number" ? info.emails_sent : 0,
            note: info.status === "sent"
              ? "Mailchimp reports this campaign as sent."
              : "Mailchimp is sending this campaign.",
            checked_at: new Date().toISOString()
          }
        });
        const values = info.status === "sent"
          ? {
              status: "sent",
              sent_at: typeof info.send_time === "string" && !isNaN(Date.parse(info.send_time))
                ? info.send_time : new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          : { status: "sending", updated_at: new Date().toISOString() };
        const { error } = await admin.from("email_campaigns").update(values)
          .eq("id", campaign.id).eq("organisation_id", campaign.organisation_id)
          .eq("revision", campaign.revision);
        if (error) throw new Error("Mailchimp status was read, but the campaign status could not be updated.");
        await audit("delivery_status_checked", {
          provider_status: info.status,
          emails_sent: info.emails_sent ?? 0,
          note: "Mailchimp delivery status checked."
        });
      } else if (existing.status === "prepared") {
        await verifyPrepared(existing);
        await updateDelivery(existing.id, {
          result: {
            ...previousResult,
            checklist_ready: true,
            note: "Prepared campaign checks passed. Review the final email before sending."
          }
        });
      } else if (["send_requested", "uncertain", "accepted"].includes(existing.status)) {
        await updateDelivery(existing.id, {
          result: {
            ...previousResult,
            note: `Mailchimp currently reports ${text(info.status)}. A send was previously requested; automatic resend is blocked.`
          }
        });
      } else if (currentPayload.final_html) {
        // A failed preparation is never silently retried.
      }

      revalidatePath(`/marketing/campaigns/${campaign.id}`);
      return view((await delivery())!);
    }

    if (input.operation === "send") {
      if (input.confirmed !== true) throw new Error("Review the final email and confirm before sending.");
      approved();
      if (!existing || existing.status !== "prepared" ||
          campaign.status !== "sending") {
        throw new Error("Prepare the approved campaign first, or refresh its delivery status.");
      }

      const providerId = await verifyPrepared(existing);

      // Atomic compare-and-set: only one request can move past this point.
      const { data: claimed, error: claimError } = await admin
        .from("email_campaign_deliveries")
        .update({
          status: "send_requested",
          updated_at: new Date().toISOString(),
          result: {
            ...object(existing.result),
            send_requested_at: new Date().toISOString(),
            note: "Customer send requested. Duplicate sends are blocked."
          }
        })
        .eq("id", existing.id)
        .eq("organisation_id", campaign.organisation_id)
        .eq("status", "prepared")
        .select("id").maybeSingle();

      if (claimError || !claimed) {
        throw new Error("Another request may already be sending this campaign. Refresh its status.");
      }

      claimedId = existing.id;
      sendRequested = true;

      await api(`campaigns/${encodeURIComponent(providerId)}/actions/send`, "POST");
      sendAccepted = true;

      await updateDelivery(existing.id, {
        status: "accepted",
        result: {
          ...object(existing.result),
          accepted_at: new Date().toISOString(),
          note: "Mailchimp accepted the customer send. Refresh delivery status to confirm completion."
        }
      });
      const recorded = await audit("mailchimp_send_accepted", {
        delivery_id: existing.id,
        provider_campaign_id: providerId,
        recipient_count: object(existing.payload).recipient_count,
        note: "Mailchimp accepted the approved customer campaign."
      });

      revalidatePath(`/marketing/campaigns/${campaign.id}`);
      revalidatePath("/marketing/campaigns");

      const result = view((await delivery())!);
      if (!recorded) result.message += " The campaign history entry could not be saved.";
      return result;
    }

    if (existing) return view(existing);

    const offer = approved();
    if (campaign.status !== "approved") {
      throw new Error("This campaign is not available for a new delivery.");
    }

    const { data: savedRecipients, error: recipientError } = await supabase
      .from("email_campaign_recipients").select("email")
      .eq("campaign_id", campaign.id)
      .eq("organisation_id", campaign.organisation_id)
      .order("email").range(0, 4000);

    if (recipientError) throw new Error("Unable to load the saved recipients.");
    const expected = addressList(savedRecipients);
    if (expected.length !== campaign.recipient_count) {
      throw new Error("The saved recipient count does not match.");
    }

    const { data: organisation, error: organisationError } = await supabase
      .from("organisations")
      .select("name,legal_name,trading_name,address_line_1,address_line_2,town_city,county,postcode,country,company_number,email_footer_text,active")
      .eq("id", campaign.organisation_id).maybeSingle();

    if (organisationError || !organisation?.active ||
        !organisation.address_line_1?.trim() ||
        !organisation.town_city?.trim() ||
        !organisation.postcode?.trim()) {
      throw new Error("Complete the organisation's business address in Settings before sending.");
    }

    const blocked = await checkRecipients(expected);
    if (blocked.length) return {
      ok: false,
      message: `${blocked.length} of ${expected.length} selected contacts are missing from Mailchimp or are not subscribed. Preparation is blocked; no contacts were added or resubscribed.`,
      total: expected.length,
      subscribed: expected.length - blocked.length,
      blocked,
      canPrepare: false
    };

    if (input.operation === "check") return {
      ok: true,
      message: `All ${expected.length} saved recipients are subscribed in Mailchimp. You can prepare the approved campaign.`,
      total: expected.length,
      subscribed: expected.length,
      canPrepare: true,
      sender: `${fromName} <${fromEmail}>`
    };

    const { data: deliveryId, error: beginError } = await supabase.rpc(
      "begin_email_campaign_delivery",
      { p_campaign_id: campaign.id, p_revision: campaign.revision }
    );
    if (beginError || typeof deliveryId !== "string") {
      throw new Error(beginError?.message || "Unable to lock the approved campaign.");
    }
    claimedId = deliveryId;

    const job = await delivery();
    if (!job || job.id !== deliveryId) throw new Error("Unable to read the locked campaign.");
    const payload = object(job.payload);
    const lockedOffer = object(payload.flyer_snapshot);
    const lockedRecipients = addressList(payload.recipients);

    if (!sameAddresses(expected, lockedRecipients) ||
        lockedOffer.html !== offer.html ||
        payload.subject !== campaign.subject) {
      throw new Error("The locked campaign differs from the checked campaign.");
    }

    const address = [
      organisation.legal_name || organisation.trading_name || organisation.name,
      organisation.address_line_1, organisation.address_line_2,
      organisation.town_city, organisation.county,
      organisation.postcode, organisation.country
    ].filter(Boolean).join(", ");

    const footerText = [
      address,
      organisation.company_number ? `Company number: ${organisation.company_number}` : "",
      organisation.email_footer_text || ""
    ].filter(Boolean).join("\n");

    const footerHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#526052;background:#f5f3ef">${escape(footerText).replace(/\n/g, "<br>")}<br><br><a href="*|UNSUB|*" style="color:#287328">Unsubscribe</a> | <a href="*|UPDATE_PROFILE|*" style="color:#287328">Update preferences</a></td></tr></table>`;

    const savedHtml = text(lockedOffer.html);
    if (!/<\/body>/i.test(savedHtml)) throw new Error("The saved email HTML is incomplete.");
    const html = savedHtml.replace(/<\/body>/i, footerHtml + "</body>");
    const plain = text(payload.email_body) +
      "\n\n" + footerText +
      "\n\nUnsubscribe: *|UNSUB|*\nUpdate preferences: *|UPDATE_PROFILE|*";

    const segment = await api(`lists/${encodeURIComponent(audience)}/segments`, "POST", {
      name: `MLT ${campaign.id.slice(0, 8)} r${campaign.revision} ${deliveryId.slice(0, 8)}`,
      static_segment: lockedRecipients
    });
    if (typeof segment.id !== "number" ||
        segment.member_count !== lockedRecipients.length) {
      throw new Error("Mailchimp could not create the exact recipient segment.");
    }

    const preparedPayload = {
      ...payload,
      audience_id: audience,
      segment_id: segment.id,
      from_email: fromEmail,
      from_name: fromName,
      footer_text: footerText
    };
    await updateDelivery(deliveryId, { payload: preparedPayload });

    const created = await api("campaigns", "POST", {
      type: "regular",
      recipients: {
        list_id: audience,
        segment_opts: { saved_segment_id: segment.id }
      },
      settings: {
        title: `MLT ${text(payload.name)} r${campaign.revision} ${deliveryId}`.slice(0, 150),
        subject_line: text(payload.subject),
        from_name: fromName,
        reply_to: fromEmail,
        auto_footer: true
      },
      tracking: { opens: true, html_clicks: true, text_clicks: true }
    });
    if (typeof created.id !== "string" || !created.id) {
      throw new Error("Mailchimp did not return a campaign reference.");
    }

    await updateDelivery(deliveryId, { provider_campaign_id: created.id });

    const { error: providerError } = await admin.from("email_campaigns")
      .update({ provider_campaign_id: created.id, updated_at: new Date().toISOString() })
      .eq("id", campaign.id).eq("organisation_id", campaign.organisation_id)
      .eq("revision", campaign.revision).eq("status", "sending");
    if (providerError) throw new Error("Unable to record the Mailchimp campaign reference.");

    await api(`campaigns/${encodeURIComponent(created.id)}/content`, "PUT", {
      html, plain_text: plain
    });
    const content = await api(`campaigns/${encodeURIComponent(created.id)}/content`);
    if (!text(content.html)) throw new Error("Mailchimp did not return the prepared email.");
    const check = await checklist(created.id);

    await updateDelivery(deliveryId, {
      status: "prepared",
      payload: {
        ...preparedPayload,
        final_html: text(content.html),
        content_hash: fingerprint(content)
      },
      result: {
        checklist_ready: check.ready,
        note: check.ready
          ? "Campaign prepared. Review the final email and footer, then confirm before sending. No customer email has been sent."
          : `Campaign prepared, but Mailchimp has outstanding checks: ${check.note || "Refresh the checks after reviewing the draft in Mailchimp."}`
      }
    });

    await audit("mailchimp_campaign_prepared", {
      delivery_id: deliveryId,
      provider_campaign_id: created.id,
      recipient_count: lockedRecipients.length,
      note: "Approved campaign prepared in Mailchimp. Customer send not requested."
    });

    revalidatePath(`/marketing/campaigns/${campaign.id}`);
    revalidatePath("/marketing/campaigns");
    return view((await delivery())!);
  } catch (error) {
    let message = error instanceof Error ? error.message : "Campaign delivery action failed.";

    if (claimedId) {
      const status = sendRequested ? (sendAccepted ? "accepted" : "uncertain") : "failed";
      const note = sendRequested
        ? (sendAccepted
            ? "Mailchimp accepted the send, but final recording was incomplete. Refresh delivery status. Do not resend."
            : "The send outcome is uncertain. Refresh delivery status and check Mailchimp. Automatic resend is blocked.")
        : `Preparation stopped: ${message} The Portal did not request a customer send.`;
      try {
        const { data: old } = await admin.from("email_campaign_deliveries")
          .select("result").eq("id", claimedId).maybeSingle();
        await admin.from("email_campaign_deliveries")
          .update({
            status,
            result: { ...object(old?.result), note },
            updated_at: new Date().toISOString()
          }).eq("id", claimedId);

        await admin.from("email_campaigns")
          .update({
            status: sendRequested ? (sendAccepted ? "sending" : "send_uncertain") : "failed",
            updated_at: new Date().toISOString()
          })
          .eq("id", input.campaignId).eq("revision", input.revision)
          .eq("status", "sending");

        revalidatePath(`/marketing/campaigns/${input.campaignId}`);
      } catch {
        // Keep the original send marker. Never automatically retry a send.
      }
      message = note;
    }

    return { ok: false, message, canPrepare: false, canSend: false };
  }
}