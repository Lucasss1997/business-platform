import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandingForm from "./BrandingForm";

export default async function OrganisationBrandingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!membership?.organisation_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Organisation branding</h1>
          <p className="text-sm text-muted-foreground">
            No organisation is currently selected.
          </p>
        </div>
      </div>
    );
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select("id, name, logo_url, brand_primary_colour, email_footer_text")
    .eq("id", membership.organisation_id)
    .single();

  if (!organisation) {
    return <div>Organisation not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organisation branding</h1>
        <p className="text-sm text-muted-foreground">
          Control the branding used across customer-facing Platform content.
        </p>
      </div>

      <BrandingForm
        organisationId={organisation.id}
        initialName={organisation.name}
        initialLogoUrl={organisation.logo_url || ""}
        initialPrimaryColour={
          organisation.brand_primary_colour || "#2563EB"
        }
        initialEmailFooter={organisation.email_footer_text || ""}
      />
    </div>
  );
}
