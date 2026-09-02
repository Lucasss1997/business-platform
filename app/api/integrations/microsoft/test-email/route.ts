import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const recipientEmail = String(body.recipientEmail || "")
    .trim()
    .toLowerCase();

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid recipient email address." },
      { status: 400 }
    );
  }

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!membership?.organisation_id) {
    return NextResponse.json(
      { error: "No organisation found." },
      { status: 400 }
    );
  }

  if (membership.role !== "admin" && !profile?.is_super_admin) {
    return NextResponse.json(
      { error: "Organisation admin access is required." },
      { status: 403 }
    );
  }

  const { data: integration, error: integrationError } = await supabase
    .from("organisation_integrations")
    .select("external_tenant_id, sender_email, status")
    .eq("organisation_id", membership.organisation_id)
    .eq("provider", "microsoft")
    .maybeSingle();

  if (integrationError || !integration) {
    return NextResponse.json(
      { error: "Microsoft 365 is not connected." },
      { status: 400 }
    );
  }

  if (integration.status !== "connected") {
    return NextResponse.json(
      { error: "Microsoft 365 connection is not active." },
      { status: 400 }
    );
  }

  if (!integration.external_tenant_id || !integration.sender_email) {
    return NextResponse.json(
      { error: "Microsoft tenant or sending mailbox is not configured." },
      { status: 400 }
    );
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Microsoft application credentials are not configured." },
      { status: 500 }
    );
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(
      integration.external_tenant_id
    )}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("Microsoft token error:", tokenData);

    return NextResponse.json(
      {
        error:
          tokenData.error_description ||
          "Could not obtain Microsoft Graph access token.",
      },
      { status: 500 }
    );
  }

  const sender = integration.sender_email;

  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      sender
    )}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: "The Platform Microsoft 365 test",
          body: {
            contentType: "HTML",
            content: `
              <div style="font-family:Arial,sans-serif">
                <h2>Microsoft 365 connection successful</h2>
                <p>This email was sent by The Platform through Microsoft Graph.</p>
                <p><strong>Sender:</strong> ${sender}</p>
              </div>
            `,
          },
          toRecipients: [
            {
              emailAddress: {
                address: recipientEmail,
              },
            },
          ],
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!graphResponse.ok) {
    const graphError = await graphResponse.text();

    console.error("Microsoft Graph send error:", graphError);

    return NextResponse.json(
      {
        error: `Microsoft Graph rejected the email: ${graphResponse.status}`,
        detail: graphError,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    sender,
    recipientEmail,
  });
}
