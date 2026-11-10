"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendMailchimpTest(form: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError || membership?.role !== "admin") {
    redirect("/settings/integrations/mailchimp?error=Admin%20access%20required.");
  }

  const campaignId = String(form.get("campaign_id") ?? "");
  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns")
    .select("id,name,revision")
    .eq("id", campaignId)
    .eq("organisation_id", membership.organisation_id)
    .maybeSingle();

  if (campaignError || !campaign) {
    redirect("/settings/integrations/mailchimp?error=Select%20an%20available%20campaign.");
  }

  const key = process.env.MAILCHIMP_API_KEY;
  const server = process.env.MAILCHIMP_SERVER_PREFIX;
  const sender = process.env.MAILCHIMP_FROM_EMAIL;
  const fromName = process.env.MAILCHIMP_FROM_NAME;
  const target = "lucas.stephenson@icloud.com";

  if (
    !key || !server || !/^us[0-9]+$/.test(server) ||
    !key.endsWith(`-${server}`) ||
    !sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender) ||
    !fromName
  ) {
    redirect("/settings/integrations/mailchimp?error=Mailchimp%20environment%20settings%20are%20missing%20or%20invalid.");
  }

  const admin = createAdminClient();

  // Avoid rapid repeat tests. Pending requests are also included.
  const { data: recent, error: recentError } = await admin
    .from("email_campaign_audit")
    .select("id")
    .eq("organisation_id", membership.organisation_id)
    .eq("action", "mailchimp_test")
    .gte("created_at", new Date(Date.now() - 60000).toISOString())
    .limit(1);

  if (recentError || recent?.length) {
    redirect("/settings/integrations/mailchimp?error=Wait%20one%20minute%20before%20another%20test.");
  }

  const auditId = randomUUID();
  const { error: auditError } = await admin
    .from("email_campaign_audit")
    .insert({
      id: auditId,
      campaign_id: campaign.id,
      organisation_id: membership.organisation_id,
      actor_id: user.id,
      action: "mailchimp_test",
      revision: campaign.revision,
      details: { status: "preparing", recipient: target }
    });

  if (auditError) {
    redirect("/settings/integrations/mailchimp?error=Could%20not%20record%20the%20test.%20Nothing%20sent.");
  }

  let providerId = "";
  let sendAttempted = false;
  let outcome = "";
  let failed = false;

  async function api(path: string, method: string, body: unknown) {
    const response = await fetch(
      `https://${server}.api.mailchimp.com/3.0/${path}`,
      {
        method,
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Basic ${Buffer.from(`mltportal:${key}`).toString("base64")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      // Return only selected diagnostics, never request headers or secrets.
      const error = await response.json().catch(() => null);
      const title = typeof error?.title === "string"
        ? error.title.slice(0, 100)
        : "Request rejected";
      throw new Error(`Mailchimp HTTP ${response.status}: ${title}`);
    }

    return response.status === 204 ? null : response.json();
  }

  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]!));

  try {
    // Intentionally omit recipients: this provider draft has no customer audience.
    const created = await api("campaigns", "POST", {
      type: "regular",
      settings: {
        title: `PORTAL TEST ONLY - ${campaign.name}`.slice(0, 150),
        subject_line: "MLT Portal - Mailchimp connection test",
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
      .update({
        details: {
          status: "prepared",
          recipient: target,
          provider_campaign_id: providerId
        }
      })
      .eq("id", auditId);

    if (referenceError) {
      throw new Error("Could not record the Mailchimp test reference.");
    }

    await api(`campaigns/${encodeURIComponent(providerId)}/content`, "PUT", {
      html: `<!doctype html><html lang="en"><body style="margin:0;background:#f1f5f9;padding:32px;font-family:Arial,sans-serif;color:#102436"><div style="max-width:600px;margin:auto;background:white;padding:32px;border-radius:12px"><p style="font-size:13px;letter-spacing:2px">MLT CONSULTANTS</p><h1 style="font-size:26px">Your Portal is connected to Mailchimp</h1><p style="line-height:1.7">This is an internal delivery test from the MLT Portal.</p><p style="line-height:1.7">Recorded against: ${escape(campaign.name)}</p><p style="line-height:1.7">No customer audience was selected and no CRM contacts were uploaded.</p><p style="font-size:12px;color:#64748b">Test message only. Product and leasing templates will follow.</p></div></body></html>`,
      plain_text: `MLT Consultants\n\nYour Portal is connected to Mailchimp.\n\nInternal test recorded against: ${campaign.name}\n\nNo customer audience was selected or CRM contacts uploaded.`
    });

    sendAttempted = true;
    await api(
      `campaigns/${encodeURIComponent(providerId)}/actions/test`,
      "POST",
      { test_emails: [target], send_type: "html" }
    );

    outcome = `Mailchimp accepted the test to ${target}. Check your inbox and junk folder.`;
  } catch (error) {
    failed = true;
    outcome = error instanceof Error ? error.message : "Mailchimp test failed.";
    if (sendAttempted) {
      outcome += " Check your inbox before retrying; delivery may be uncertain.";
    }
  }

  const { error: recordError } = await admin
    .from("email_campaign_audit")
    .update({
      details: {
        status: failed ? (sendAttempted ? "unconfirmed" : "failed") : "accepted",
        recipient: target,
        provider_campaign_id: providerId || null,
        note: outcome
      }
    })
    .eq("id", auditId);

  if (recordError) {
    outcome += " The final test result could not be recorded.";
    failed = true;
  }

  redirect(
    `/settings/integrations/mailchimp?${failed ? "error" : "message"}=${encodeURIComponent(outcome)}`
  );
}