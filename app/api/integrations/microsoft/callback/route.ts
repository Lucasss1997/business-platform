import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const adminConsent = url.searchParams.get("admin_consent");
  const tenantId = url.searchParams.get("tenant");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const baseUrl = url.origin;

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations/microsoft?error=${encodeURIComponent(
          errorDescription || error
        )}`,
        baseUrl
      )
    );
  }

  if (adminConsent !== "True" || !tenantId || !returnedState) {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations/microsoft?error=Microsoft%20consent%20was%20not%20completed.",
        baseUrl
      )
    );
  }

  const cookieState = request.cookies.get("microsoft_connect_state")?.value;

  if (!cookieState || cookieState !== returnedState) {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations/microsoft?error=Invalid%20or%20expired%20connection%20state.",
        baseUrl
      )
    );
  }

  let state: {
    organisationId: string;
    userId: string;
    nonce: string;
  };

  try {
    state = JSON.parse(
      Buffer.from(returnedState, "base64url").toString("utf8")
    );
  } catch {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations/microsoft?error=Invalid%20connection%20state.",
        baseUrl
      )
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations/microsoft?error=Platform%20session%20could%20not%20be%20verified.",
        baseUrl
      )
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
    .eq("organisation_id", state.organisationId)
    .eq("user_id", user.id)
    .maybeSingle();

  const allowed =
    profile?.is_super_admin === true ||
    (membership?.active === true && membership?.role === "admin");

  if (!allowed) {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations/microsoft?error=Organisation%20admin%20access%20is%20required.",
        baseUrl
      )
    );
  }

  const { error: saveError } = await supabase
    .from("organisation_integrations")
    .upsert(
      {
        organisation_id: state.organisationId,
        provider: "microsoft",
        status: "connected",
        external_tenant_id: tenantId,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organisation_id,provider",
      }
    );

  if (saveError) {
    console.error("Microsoft integration save failed:", saveError);

    return NextResponse.redirect(
      new URL(
        `/settings/integrations/microsoft?error=${encodeURIComponent(
          "Microsoft consent succeeded but the connection could not be saved."
        )}`,
        baseUrl
      )
    );
  }

  const response = NextResponse.redirect(
    new URL(
      "/settings/integrations/microsoft?connected=1",
      baseUrl
    )
  );

  response.cookies.set("microsoft_connect_state", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
