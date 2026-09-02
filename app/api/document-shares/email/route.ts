import { createDecipheriv } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getEncryptionKey() {
  const encodedKey = process.env.SHARE_TOKEN_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error("SHARE_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new Error("SHARE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  return key;
}

function decryptToken(value: string) {
  const [ivValue, authTagValue, encryptedValue] = value.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Stored share token is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url")
  );

  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validHexColour(value: string | null | undefined) {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return "#2563EB";
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
    const shareId = String(body.shareId || "");

    if (!shareId) {
      return NextResponse.json(
        { error: "A share ID is required." },
        { status: 400 }
      );
    }

    const { data: share, error: shareError } = await supabase
      .from("document_shares")
      .select(`
        id,
        organisation_id,
        document_id,
        recipient_email,
        token_encrypted,
        expires_at,
        revoked_at
      `)
      .eq("id", shareId)
      .single();

    if (shareError || !share) {
      return NextResponse.json(
        { error: "Secure share not found." },
        { status: 404 }
      );
    }

    if (share.revoked_at) {
      return NextResponse.json(
        { error: "This secure share has been revoked." },
        { status: 400 }
      );
    }

    if (new Date(share.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This secure share has expired." },
        { status: 400 }
      );
    }

    if (!share.recipient_email || !share.token_encrypted) {
      return NextResponse.json(
        { error: "This secure share cannot be emailed." },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role, active")
      .eq("user_id", user.id)
      .eq("organisation_id", share.organisation_id)
      .eq("active", true)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!membership && !profile?.is_super_admin) {
      return NextResponse.json(
        { error: "You do not have access to this organisation." },
        { status: 403 }
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, title, file_name")
      .eq("id", share.document_id)
      .eq("organisation_id", share.organisation_id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    const { data: organisation, error: organisationError } = await supabase
      .from("organisations")
      .select(`
        name,
        legal_name,
        trading_name,
        logo_url,
        brand_primary_colour,
        email_footer_text,
        company_number,
        vat_number,
        telephone,
        email,
        website
      `)
      .eq("id", share.organisation_id)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json(
        { error: "Organisation branding could not be loaded." },
        { status: 500 }
      );
    }

    const { data: integration, error: integrationError } = await supabase
      .from("organisation_integrations")
      .select("external_tenant_id, sender_email, status")
      .eq("organisation_id", share.organisation_id)
      .eq("provider", "microsoft")
      .maybeSingle();

    if (
      integrationError ||
      !integration ||
      integration.status !== "connected" ||
      !integration.external_tenant_id ||
      !integration.sender_email
    ) {
      return NextResponse.json(
        { error: "Microsoft 365 email is not configured for this organisation." },
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

    const token = decryptToken(share.token_encrypted);

    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/share/${token}`;

    const displayName =
      organisation.trading_name ||
      organisation.name ||
      organisation.legal_name ||
      "The Platform";

    const brandColour = validHexColour(
      organisation.brand_primary_colour
    );

    const safeName = escapeHtml(displayName);
    const safeTitle = escapeHtml(document.title || document.file_name);
    const safeShareUrl = escapeHtml(shareUrl);
    const safeRecipient = escapeHtml(share.recipient_email);
    const safeFooter = organisation.email_footer_text
      ? escapeHtml(organisation.email_footer_text).replaceAll("\n", "<br>")
      : "";

    const logoHtml = organisation.logo_url
      ? `
        <div style="margin-bottom:28px;">
          <img
            src="${escapeHtml(organisation.logo_url)}"
            alt="${safeName}"
            style="display:block;max-width:220px;max-height:80px;width:auto;height:auto;"
          />
        </div>
      `
      : "";

    const legalParts = [
      organisation.company_number
        ? `Company No. ${escapeHtml(organisation.company_number)}`
        : "",
      organisation.vat_number
        ? `VAT No. ${escapeHtml(organisation.vat_number)}`
        : "",
    ].filter(Boolean);

    const legalHtml =
      legalParts.length > 0
        ? `<div style="margin-top:8px;">${legalParts.join(" &nbsp; | &nbsp; ")}</div>`
        : "";

    const emailHtml = `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f4f6f8;">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="background:#f4f6f8;padding:32px 16px;"
          >
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;"
                >
                  <tr>
                    <td style="padding:40px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                      ${logoHtml}

                      <h1 style="margin:0;font-size:24px;line-height:32px;font-weight:700;">
                        A document has been shared with you
                      </h1>

                      <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#4b5563;">
                        ${safeName} has securely shared a document with you.
                      </p>

                      <div style="margin:28px 0;padding:18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
                        <div style="font-size:12px;line-height:18px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">
                          Document
                        </div>

                        <div style="margin-top:5px;font-size:16px;line-height:24px;font-weight:700;color:#111827;">
                          ${safeTitle}
                        </div>
                      </div>

                      <a
                        href="${safeShareUrl}"
                        style="display:inline-block;background:${brandColour};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 20px;border-radius:8px;"
                      >
                        View secure document
                      </a>

                      <p style="margin:24px 0 0;font-size:13px;line-height:21px;color:#6b7280;">
                        For security, you will be asked to enter the email address this document was shared with:
                        <strong>${safeRecipient}</strong>
                      </p>

                      <p style="margin:8px 0 0;font-size:13px;line-height:21px;color:#6b7280;">
                        This secure link expires ${escapeHtml(
                          new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(share.expires_at))
                        )}.
                      </p>

                      ${
                        safeFooter
                          ? `
                            <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;line-height:21px;color:#6b7280;">
                              ${safeFooter}
                            </div>
                          `
                          : ""
                      }

                      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;line-height:18px;color:#9ca3af;">
                        Sent securely by ${safeName}
                        ${legalHtml}
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
      console.error("Microsoft token error:", {
        status: tokenResponse.status,
        error: tokenData.error,
      });

      return NextResponse.json(
        { error: "Could not connect to Microsoft 365." },
        { status: 500 }
      );
    }

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
            subject: `${displayName} shared a document with you`,
            body: {
              contentType: "HTML",
              content: emailHtml,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: share.recipient_email,
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

      console.error(
        "Microsoft Graph secure share send failed:",
        graphResponse.status,
        graphError
      );

      return NextResponse.json(
        { error: "Microsoft 365 could not send the secure-share email." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipientEmail: share.recipient_email,
      senderEmail: integration.sender_email,
    });
  } catch (error) {
    console.error("Secure share email error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The secure-share email could not be sent.",
      },
      { status: 500 }
    );
  }
}
