import { readFile } from "node:fs/promises";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMarketingProductPhoto } from "@/app/marketing/products/actions";
import { getMarketingBranding } from "@/app/marketing/branding-actions";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import InstagridRentalBuilder from "@/components/marketing/InstagridRentalBuilder";

export default async function InstagridRentalPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: member, error: memberError } = await supabase
    .from("organisation_members")
    .select("organisation_id,role")
    .eq("user_id", user.id).eq("active", true).maybeSingle();

  if (memberError || !member ||
      !["admin", "user"].includes(member.role)) {
    return <AppShell><p role="alert" className="p-8">
      An active sales or admin account is required.
    </p></AppShell>;
  }

  const { data: testCampaignRows } = ["admin", "user"].includes(member.role)
    ? await supabase.from("email_campaigns")
        .select("id,name,status,revision,created_by")
        .eq("organisation_id", member.organisation_id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const testCampaigns = testCampaignRows || [];
  const { data: profile } = await supabase
    .from("profiles").select("display_name")
    .eq("id", user.id).maybeSingle();

  let assets: {
    photo: string;
    logo: string;
    colour: string;
  } | null = null;
  let assetError = "";

  try {
    const [product, branding] = await Promise.all([
      getMarketingProductPhoto("ce3be559-b908-460a-b1f4-abc8745b7d59"),
      getMarketingBranding("MLT Consultants")
    ]);
    assets = {
      photo: product.photo,
      logo: `data:image/png;base64,${(await readFile(process.cwd() + "/public/branding/mlt-logo.png")).toString("base64")}`,
      colour: branding.colour
    };
  } catch (error) {
    assetError = error instanceof Error
      ? error.message : "Unable to load approved artwork.";
  }

  return <AppShell>
    <PageHeader
      eyebrow="Marketing templates"
      title="Instagrid ONE rental"
      subtitle="Create your individual rental flyer and matching email copy."
    />
    <section className="space-y-5 p-6 lg:p-10">
      <Link href="/marketing/campaigns"
        className="font-semibold text-[var(--accent)]">
        Back to campaigns
      </Link>
      {assets ? (
        <InstagridRentalBuilder
          photo={assets.photo}
          logo={assets.logo}
          colour={assets.colour}
          storageKey={`mlt-instagrid-rental-v1:${member.organisation_id}:${user.id}`}
          initialName={profile?.display_name || ""}
          initialEmail={user.email || ""}
          testCampaigns={testCampaigns}
          offerCampaigns={testCampaigns.filter(campaign => campaign.created_by === user.id && ["draft", "returned"].includes(campaign.status))}
        />
      ) : (
        <div role="alert" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          {assetError}
          <Link href="/marketing/products" className="mt-3 block underline">
            Check the approved product photograph
          </Link>
        </div>
      )}
    </section>
  </AppShell>;
}