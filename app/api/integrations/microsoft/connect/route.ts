import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
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

  const organisationId = membership?.organisation_id;

  if (!organisationId && !profile?.is_super_admin) {
    return NextResponse.json(
      { error: "No organisation found for this user." },
      { status: 400 }
    );
  }

  if (membership && membership.role !== "admin" && !profile?.is_super_admin) {
    return NextResponse.json(
      { error: "Organisation admin access is required." },
      { status: 403 }
    );
  }

  if (!organisationId) {
    return NextResponse.json(
      { error: "Super admin must select an organisation before connecting Microsoft 365." },
      { status: 400 }
    );
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Microsoft integration environment variables are not configured." },
      { status: 500 }
    );
  }

  const nonce = randomBytes(24).toString("hex");

  const statePayload = Buffer.from(
    JSON.stringify({
      organisationId,
      userId: user.id,
      nonce,
    })
  ).toString("base64url");

  const response = NextResponse.redirect(
    `https://login.microsoftonline.com/common/adminconsent?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(statePayload)}`
  );

  response.cookies.set("microsoft_connect_state", statePayload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return response;
}
