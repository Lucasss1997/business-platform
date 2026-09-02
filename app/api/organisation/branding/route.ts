import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

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

    const formData = await request.formData();

    const organisationId = String(
      formData.get("organisationId") || ""
    );

    const name = String(formData.get("name") || "").trim();

    const brandPrimaryColour = String(
      formData.get("brandPrimaryColour") || ""
    ).trim();

    const emailFooterText = String(
      formData.get("emailFooterText") || ""
    ).trim();

    const logo = formData.get("logo");

    if (!organisationId) {
      return NextResponse.json(
        { error: "Organisation is required." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Organisation name is required." },
        { status: 400 }
      );
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(brandPrimaryColour)) {
      return NextResponse.json(
        { error: "Invalid brand colour." },
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
      .select("organisation_id, role, active")
      .eq("user_id", user.id)
      .eq("organisation_id", organisationId)
      .eq("active", true)
      .maybeSingle();

    const isSuperAdmin = profile?.is_super_admin === true;
    const isOrganisationAdmin =
      membership?.active === true && membership?.role === "admin";

    if (!isSuperAdmin && !isOrganisationAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to change this branding." },
        { status: 403 }
      );
    }

    let logoUrl: string | null = null;

    if (logo instanceof File && logo.size > 0) {
      if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
        return NextResponse.json(
          { error: "Logo must be PNG, JPEG or WebP." },
          { status: 400 }
        );
      }

      if (logo.size > MAX_LOGO_SIZE) {
        return NextResponse.json(
          { error: "Logo must be 2 MB or smaller." },
          { status: 400 }
        );
      }

      const logoPath = `${organisationId}/master-logo`;

      const { error: uploadError } = await supabase.storage
        .from("organisation-branding")
        .upload(logoPath, logo, {
          contentType: logo.type,
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Branding logo upload failed:", uploadError);

        return NextResponse.json(
          { error: "Unable to upload organisation logo." },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("organisation-branding")
        .getPublicUrl(logoPath);

      logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    }

    const updateData: {
      name: string;
      brand_primary_colour: string;
      email_footer_text: string | null;
      updated_at: string;
      logo_url?: string;
    } = {
      name,
      brand_primary_colour: brandPrimaryColour,
      email_footer_text: emailFooterText || null,
      updated_at: new Date().toISOString(),
    };

    if (logoUrl) {
      updateData.logo_url = logoUrl;
    }

    const { data: organisation, error: updateError } = await supabase
      .from("organisations")
      .update(updateData)
      .eq("id", organisationId)
      .select(
        "id, name, logo_url, brand_primary_colour, email_footer_text"
      )
      .single();

    if (updateError) {
      console.error("Branding update failed:", updateError);

      return NextResponse.json(
        { error: "Unable to save organisation branding." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organisation,
      logoUrl: organisation.logo_url,
    });
  } catch (error) {
    console.error("Organisation branding error:", error);

    return NextResponse.json(
      { error: "Unable to save organisation branding." },
      { status: 500 }
    );
  }
}
