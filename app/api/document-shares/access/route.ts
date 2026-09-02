import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token = body?.token;
    const suppliedEmail = body?.email;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "The share link is invalid." },
        { status: 400 },
      );
    }

    if (!suppliedEmail || typeof suppliedEmail !== "string") {
      return NextResponse.json(
        { error: "Enter the email address this document was shared with." },
        { status: 400 },
      );
    }

    const email = normaliseEmail(suppliedEmail);

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const supabase = createAdminClient();

    const { data: share, error: shareError } = await supabase
      .from("document_shares")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (shareError || !share) {
      return NextResponse.json(
        { error: "This share link is invalid." },
        { status: 404 },
      );
    }

    if (share.revoked_at) {
      return NextResponse.json(
        { error: "This share link has been revoked." },
        { status: 403 },
      );
    }

    if (new Date(share.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This share link has expired." },
        { status: 403 },
      );
    }

    const recipientEmail = normaliseEmail(share.recipient_email || "");

    if (!recipientEmail || recipientEmail !== email) {
      return NextResponse.json(
        {
          error: "That email address does not have access to this document.",
          canRequestAccess: true,
        },
        { status: 403 },
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select(
        "id, title, description, file_name, file_path, mime_type, file_size",
      )
      .eq("id", share.document_id)
      .eq("organisation_id", share.organisation_id)
      .maybeSingle();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "The document could not be found." },
        { status: 404 },
      );
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.file_path, 300);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "The document could not be prepared for viewing." },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor
      ? forwardedFor.split(",")[0]?.trim()
      : null;

    const userAgent = request.headers.get("user-agent");

    await supabase
      .from("document_share_accesses")
      .insert({
        share_id: share.id,
        document_id: document.id,
        organisation_id: share.organisation_id,
        email,
        accessed_at: now,
        user_agent: userAgent,
        ip_address: ipAddress,
      });

    await supabase
      .from("document_shares")
      .update({
        last_accessed_at: now,
        access_count: (share.access_count ?? 0) + 1,
      })
      .eq("id", share.id);

    return NextResponse.json({
      success: true,
      document: {
        title: document.title,
        description: document.description,
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSize: document.file_size,
      },
      url: signedData.signedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Access could not be verified.",
      },
      { status: 500 },
    );
  }
}
