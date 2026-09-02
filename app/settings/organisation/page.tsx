import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OrganisationSettingsPage() {
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
    .select("name")
    .eq("id", membership.organisation_id)
    .single();

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          Settings
        </p>

        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Organisation
        </h1>

        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Manage business details and branding for {organisation?.name || "your organisation"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/settings/organisation/business-details"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Business details
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Legal name, address, company number, VAT number and contact details.
          </p>
        </Link>

        <Link
          href="/settings/organisation/branding"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Branding
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Master logo, brand colour and customer-facing email branding.
          </p>
        </Link>
      </div>
    </div>
  );
}
