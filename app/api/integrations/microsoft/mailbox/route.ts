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
  const senderEmail = String(body.senderEmail || "")
    .trim()
    .toLowerCase();

  if (!senderEmail || !senderEmail.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
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

  const { error } = await supabase
    .from("organisation_integrations")
    .update({
      sender_email: senderEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", membership.organisation_id)
    .eq("provider", "microsoft");

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    senderEmail,
  });
}
