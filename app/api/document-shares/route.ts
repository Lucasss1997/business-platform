import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SHARE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

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

function encryptToken(token: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptToken(value: string) {
  const [ivValue, authTagValue, encryptedValue] = value.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Stored share token is invalid.");
  }

  const key = getEncryptionKey();

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const body = await request.json();

    const documentId = body?.documentId;
    const suppliedEmail = body?.recipientEmail;

    if (!documentId || typeof documentId !== "string") {
      return NextResponse.json(
        { error: "A document ID is required." },
        { status: 400 },
      );
    }

    if (!suppliedEmail || typeof suppliedEmail !== "string") {
      return NextResponse.json(
        { error: "A recipient email address is required." },
        { status: 400 },
      );
    }

    const recipientEmail = normaliseEmail(suppliedEmail);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: "Enter a valid recipient email address." },
        { status: 400 },
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, organisation_id")
      .eq("id", documentId)
      .single();

    if (documentError || !document?.organisation_id) {
      return NextResponse.json(
        { error: "The document could not be found." },
        { status: 404 },
      );
    }

    const { data: existingShares, error: existingShareError } = await supabase
      .from("document_shares")
      .select(
        "id, token_encrypted, expires_at, access_count, last_accessed_at, contact_id",
      )
      .eq("document_id", document.id)
      .eq("organisation_id", document.organisation_id)
      .eq("recipient_email", recipientEmail)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingShareError) {
      return NextResponse.json(
        { error: existingShareError.message },
        { status: 400 },
      );
    }

    const existingShare = existingShares?.[0] ?? null;
    const origin = new URL(request.url).origin;

    if (existingShare?.token_encrypted) {
      const token = decryptToken(existingShare.token_encrypted);

      const currentExpiry = new Date(existingShare.expires_at).getTime();
      const extensionBase = Math.max(Date.now(), currentExpiry);

      const expiresAt = new Date(
        extensionBase + SHARE_DURATION_MS,
      ).toISOString();

      const { data: updatedShare, error: updateError } = await supabase
        .from("document_shares")
        .update({
          expires_at: expiresAt,
        })
        .eq("id", existingShare.id)
        .select("id, expires_at, access_count, last_accessed_at, contact_id")
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 },
        );
      }

      return NextResponse.json({
        id: updatedShare.id,
        url: `${origin}/share/${token}`,
        recipientEmail,
        expiresAt: updatedShare.expires_at,
        accessCount: updatedShare.access_count ?? 0,
        lastAccessedAt: updatedShare.last_accessed_at,
        contactId: updatedShare.contact_id,
        reused: true,
      });
    }

    const token = randomBytes(32).toString("base64url");

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const tokenEncrypted = encryptToken(token);

    const expiresAt = new Date(
      Date.now() + SHARE_DURATION_MS,
    ).toISOString();

    const { data: share, error: shareError } = await supabase
      .from("document_shares")
      .insert({
        organisation_id: document.organisation_id,
        document_id: document.id,
        token_hash: tokenHash,
        token_encrypted: tokenEncrypted,
        recipient_email: recipientEmail,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select("id, expires_at, access_count, last_accessed_at, contact_id")
      .single();

    if (shareError) {
      return NextResponse.json(
        { error: shareError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      id: share.id,
      url: `${origin}/share/${token}`,
      recipientEmail,
      expiresAt: share.expires_at,
      accessCount: share.access_count ?? 0,
      lastAccessedAt: share.last_accessed_at,
      contactId: share.contact_id,
      reused: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The share link could not be created.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const shareId = body?.shareId;

    if (!shareId || typeof shareId !== "string") {
      return NextResponse.json(
        { error: "A share ID is required." },
        { status: 400 },
      );
    }

    const { data: share, error } = await supabase
      .from("document_shares")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("id", shareId)
      .select("id")
      .single();

    if (error || !share) {
      return NextResponse.json(
        { error: error?.message || "The share link could not be revoked." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The share link could not be revoked.",
      },
      { status: 500 },
    );
  }
}
