import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyCampaignApprovers(
  campaignId: string,
  revision: number
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) return { ok: false };

  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns")
    .select("id,organisation_id,created_by,name,status,revision,recipient_count,internal_estimate_pence")
    .eq("id", campaignId)
    .maybeSingle();

  if (
    campaignError || !campaign ||
    campaign.created_by !== user.id ||
    campaign.status !== "pending_approval" ||
    campaign.revision !== revision
  ) return { ok: false };

  const admin = createAdminClient();

  const { data: queue, error: queueError } = await admin
    .from("email_campaign_notifications")
    .select("id,recipient_user_id,recipient_email")
    .eq("campaign_id", campaignId)
    .eq("organisation_id", campaign.organisation_id)
    .eq("revision", revision)
    .eq("status", "pending");

  if (queueError || !queue?.length) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: integration, error: integrationError } = await admin
    .from("organisation_integrations")
    .select("external_tenant_id,sender_email,status")
    .eq("organisation_id", campaign.organisation_id)
    .eq("provider", "microsoft")
    .maybeSingle();

  let token = "";
  let reviewUrl = "";
  let setupError = "";

  try {
    // Fixed trusted fallback also supports the live deployment before
    // PORTAL_BASE_URL has been added to its hosting settings.
    const base = new URL(
      process.env.PORTAL_BASE_URL ||
      "https://platform.mltconsultants.co.uk"
    );

    if (
      base.username || base.password ||
      base.protocol !== "https:"
    ) {
      throw new Error("Portal URL must be a valid HTTPS address.");
    }

    reviewUrl = new URL(
      `/marketing/campaigns/${campaignId}`,
      base.origin
    ).href;

    if (
      integrationError ||
      integration?.status !== "connected" ||
      !integration.external_tenant_id ||
      !integration.sender_email
    ) {
      throw new Error("Microsoft 365 sending mailbox is not connected.");
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Microsoft application credentials are missing.");
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(integration.external_tenant_id)}/oauth2/v2.0/token`,
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials"
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Microsoft authentication failed (HTTP ${response.status}).`
      );
    }

    const result = await response.json();

    if (
      typeof result.access_token !== "string" ||
      !result.access_token
    ) {
      throw new Error("Microsoft did not return an access token.");
    }

    token = result.access_token;
  } catch (error) {
    setupError = error instanceof Error
      ? error.message
      : "Email setup failed.";
  }

  if (setupError) {
    const { error } = await admin
      .from("email_campaign_notifications")
      .update({
        status: "failed",
        last_error: setupError
      })
      .eq("campaign_id", campaignId)
      .eq("revision", revision)
      .eq("status", "pending");

    if (error) {
      console.error(
        "Approval notification failure could not be recorded."
      );
    }

    return { ok: false };
  }

  let allAccepted = true;

  const estimate = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(Number(campaign.internal_estimate_pence) / 100);

  const content = [
    "A campaign is awaiting your approval.",
    "",
    `Campaign: ${campaign.name}`,
    `Submitted by: ${profile?.display_name || user.email || "Portal user"}`,
    `Recipients: ${campaign.recipient_count}`,
    `Internal estimate: ${estimate}`,
    "",
    "This estimate is an internal value, not an additional Mailchimp charge.",
    "",
    "Review campaign:",
    reviewUrl,
    "",
    "Sign in with your organisation admin account to approve or return it.",
    "This notification does not send the customer campaign."
  ].join("\n");

  for (const notification of queue) {
    // Only one request can claim a pending notification.
    const { data: claimed, error: claimError } = await admin
      .from("email_campaign_notifications")
      .update({
        status: "processing",
        attempts: 1,
        attempted_at: new Date().toISOString(),
        last_error: null
      })
      .eq("id", notification.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      allAccepted = false;
      continue;
    }

    let status = "failed";
    let lastError: string | null = null;
    let attemptedSend = false;

    try {
      const { data: current, error: currentError } = await admin
        .from("email_campaigns")
        .select("status,revision")
        .eq("id", campaignId)
        .eq("organisation_id", campaign.organisation_id)
        .single();

      const { data: member, error: memberError } = await admin
        .from("organisation_members")
        .select("role,active")
        .eq("organisation_id", campaign.organisation_id)
        .eq("user_id", notification.recipient_user_id)
        .maybeSingle();

      if (currentError || memberError) {
        throw new Error(
          "Unable to recheck campaign or recipient access."
        );
      }

      if (
        current.status !== "pending_approval" ||
        current.revision !== revision ||
        member?.role !== "admin" ||
        !member.active
      ) {
        status = "cancelled";
        lastError = "Campaign or admin access changed before sending.";
      } else {
        attemptedSend = true;

        const response = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(integration!.sender_email!)}/sendMail`,
          {
            method: "POST",
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: {
                subject: `Approval required: ${campaign.name}`,
                body: {
                  contentType: "Text",
                  content
                },
                toRecipients: [{
                  emailAddress: {
                    address: notification.recipient_email
                  }
                }]
              },
              saveToSentItems: true
            })
          }
        );

        if (response.ok) {
          status = "accepted";
        } else {
          status = response.status >= 500
            ? "uncertain"
            : "failed";
          lastError =
            `Microsoft returned HTTP ${response.status}.`;
        }
      }
    } catch (error) {
      status = attemptedSend ? "uncertain" : "failed";
      lastError = attemptedSend
        ? "Microsoft acceptance is uncertain. Check Sent Items before retrying."
        : error instanceof Error
          ? error.message
          : "Notification failed.";
    }

    const { error: recordError } = await admin
      .from("email_campaign_notifications")
      .update({
        status,
        last_error: lastError,
        accepted_at: status === "accepted"
          ? new Date().toISOString()
          : null
      })
      .eq("id", notification.id)
      .eq("status", "processing");

    if (recordError) {
      console.error(
        "Approval notification result could not be recorded."
      );
      allAccepted = false;
    }

    if (status !== "accepted") allAccepted = false;
  }

  return { ok: allAccepted };
}