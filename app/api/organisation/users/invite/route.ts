import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validHexColour(value: string | null | undefined) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#2563EB";
}

export async function POST(request: NextRequest) {
  try {
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

    const displayName = String(body.displayName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "user");

    if (!displayName) {
      return NextResponse.json(
        { error: "Enter the user's name." },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (!["admin", "user", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid user role." },
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

    const organisationId = membership.organisation_id;

    const { data: organisation, error: organisationError } = await supabase
      .from("organisations")
      .select(
        "name, trading_name, legal_name, logo_url, brand_primary_colour, email_footer_text"
      )
      .eq("id", organisationId)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json(
        { error: "Organisation could not be loaded." },
        { status: 500 }
      );
    }

    const { data: integration } = await supabase
      .from("organisation_integrations")
      .select("external_tenant_id, sender_email, status")
      .eq("organisation_id", organisationId)
      .eq("provider", "microsoft")
      .maybeSingle();

    if (
      !integration ||
      integration.status !== "connected" ||
      !integration.external_tenant_id ||
      !integration.sender_email
    ) {
      return NextResponse.json(
        { error: "Microsoft 365 email is not configured." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const origin = new URL(request.url).origin;

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `${origin}/setup-account`,
          data: {
            display_name: displayName,
          },
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json(
        { error: linkError?.message || "Could not create the invitation." },
        { status: 400 }
      );
    }

    const invitedUserId = linkData.user?.id;

    if (!invitedUserId) {
      return NextResponse.json(
        { error: "The invited user could not be created." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          display_name: displayName,
          email,
          is_super_admin: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw profileError;
    }

    const { error: membershipError } = await admin
      .from("organisation_members")
      .upsert(
        {
          organisation_id: organisationId,
          user_id: invitedUserId,
          role,
          active: true,
        },
        { onConflict: "organisation_id,user_id" }
      );

    if (membershipError) {
      throw membershipError;
    }

    await admin.from("user_invitations").insert({
      organisation_id: organisationId,
      email,
      display_name: displayName,
      role,
      invited_by: user.id,
      invited_user_id: invitedUserId,
      status: "pending",
    });

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Microsoft application credentials are not configured.");
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
      throw new Error("Could not connect to Microsoft 365.");
    }

    const organisationName =
      organisation.trading_name ||
      organisation.name ||
      organisation.legal_name ||
      "The Platform";

    const safeOrganisation = escapeHtml(organisationName);
    const safeName = escapeHtml(displayName);
    const safeLink = escapeHtml(linkData.properties.action_link);
    const brandColour = validHexColour(
      organisation.brand_primary_colour
    );

    const logoHtml = organisation.logo_url
      ? `<img src="${escapeHtml(
          organisation.logo_url
        )}" alt="${safeOrganisation}" style="display:block;max-width:200px;max-height:75px;margin-bottom:28px;">`
      : "";

    const footerHtml = organisation.email_footer_text
      ? `<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${escapeHtml(
          organisation.email_footer_text
        ).replaceAll("\n", "<br>")}</div>`
      : "";

    const emailHtml = `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f4f6f8;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="background:#f4f6f8;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:40px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                      ${logoHtml}

                      <h1 style="margin:0;font-size:26px;line-height:34px;">
                        Welcome to The Platform
                      </h1>

                      <p style="margin:18px 0 0;font-size:15px;line-height:24px;color:#4b5563;">
                        Hi ${safeName},
                      </p>

                      <p style="margin:10px 0 0;font-size:15px;line-height:24px;color:#4b5563;">
                        You have been invited to join
                        <strong>${safeOrganisation}</strong>
                        on The Platform.
                      </p>

                      <p style="margin:10px 0 0;font-size:15px;line-height:24px;color:#4b5563;">
                        Use the button below to set up your account and access your organisation's companies, sales, tasks and documents.
                      </p>

                      <div style="margin-top:28px;">
                        <a href="${safeLink}"
                          style="display:inline-block;background:${brandColour};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 20px;border-radius:8px;">
                          Set up my account
                        </a>
                      </div>

                      <p style="margin:24px 0 0;font-size:12px;line-height:20px;color:#9ca3af;">
                        This invitation is unique to your email address. If you were not expecting this invitation, you can ignore this email.
                      </p>

                      ${footerHtml}

                      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;line-height:18px;color:#9ca3af;">
                        Sent securely by ${safeOrganisation}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
        integration.sender_email
      )}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: `You've been invited to ${organisationName} on The Platform`,
            body: {
              contentType: "HTML",
              content: emailHtml,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: email,
                },
              },
            ],
          },
          saveToSentItems: true,
        }),
      }
    );

    if (!graphResponse.ok) {
      console.error(
        "Microsoft invitation email failed:",
        graphResponse.status,
        await graphResponse.text()
      );

      return NextResponse.json(
        {
          error:
            "The user was created, but the welcome email could not be sent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
      displayName,
      role,
    });
  } catch (error) {
    console.error("User invitation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The user could not be invited.",
      },
      { status: 500 }
    );
  }
}