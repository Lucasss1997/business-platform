import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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
    const organisationId = String(body.organisationId || "");

    if (!organisationId) {
      return NextResponse.json(
        { error: "Organisation is required." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role, active")
      .eq("user_id", user.id)
      .eq("organisation_id", organisationId)
      .eq("active", true)
      .maybeSingle();

    const allowed =
      profile?.is_super_admin === true ||
      (membership?.active === true && membership?.role === "admin");

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to update this organisation." },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("organisations")
      .update({
        legal_name: String(body.legal_name || "").trim() || null,
        trading_name: String(body.trading_name || "").trim() || null,
        address_line_1: String(body.address_line_1 || "").trim() || null,
        address_line_2: String(body.address_line_2 || "").trim() || null,
        town_city: String(body.town_city || "").trim() || null,
        county: String(body.county || "").trim() || null,
        postcode: String(body.postcode || "").trim() || null,
        country: String(body.country || "").trim() || null,
        company_number: String(body.company_number || "").trim() || null,
        vat_number: String(body.vat_number || "").trim() || null,
        telephone: String(body.telephone || "").trim() || null,
        email: String(body.email || "").trim() || null,
        website: String(body.website || "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organisationId);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Unable to save business details." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to save business details." },
      { status: 500 }
    );
  }
}
