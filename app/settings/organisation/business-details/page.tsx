import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BusinessDetailsForm from "./BusinessDetailsForm";

export default async function BusinessDetailsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!membership?.organisation_id) {
    return <div>No organisation selected.</div>;
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select(`
      id,
      name,
      legal_name,
      trading_name,
      address_line_1,
      address_line_2,
      town_city,
      county,
      postcode,
      country,
      company_number,
      vat_number,
      telephone,
      email,
      website
    `)
    .eq("id", membership.organisation_id)
    .single();

  if (!organisation) {
    return <div>Organisation not found.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          Organisation
        </p>

        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Business details
        </h1>

        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          These details will be used on quotes, proposals, invoices and other customer-facing documents.
        </p>
      </div>

      <BusinessDetailsForm organisation={organisation} />
    </div>
  );
}
