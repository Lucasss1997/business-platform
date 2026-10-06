import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import MarketingClient from "@/components/marketing/MarketingClient";

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketing"
        title="Marketing workspace"
        subtitle="Prepare targeted content briefs using approved business information."
      />
      <section className="p-6 lg:p-10">
        {error ? (
          <p role="alert">Unable to check organisation access. Please try again.</p>
        ) : !membership?.organisation_id ? (
          <p>No active organisation is available for your account.</p>
        ) : (
          <MarketingClient />
        )}
      </section>
    </AppShell>
  );
}