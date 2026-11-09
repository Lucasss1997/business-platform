import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import { createCampaignDraft } from "./actions";

const money = (pence: number | string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(Number(pence) / 100);

const errors: Record<string, string> = {
  access: "Unable to verify organisation access. Please sign in again.",
  permission: "Your account has read-only access.",
  validation: "Enter a name and objective, and check the field lengths and reply address.",
  settings: "Unable to load internal estimate rates. Please try again.",
  save: "The draft could not be saved. Please try again."
};

export default async function CampaignsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError || !membership?.organisation_id) {
    return (
      <AppShell>
        <section className="p-6 lg:p-10">
          <p role="alert">Unable to verify organisation access.</p>
        </section>
      </AppShell>
    );
  }

  const { data: campaigns, error: loadError } = await supabase
    .from("email_campaigns")
    .select("id,name,objective,status,recipient_count,internal_estimate_pence,created_at,created_by")
    .eq("organisation_id", membership.organisation_id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: settings, error: settingsError } = await supabase
    .from("email_campaign_settings")
    .select("preparation_pence,recipient_pence")
    .eq("organisation_id", membership.organisation_id)
    .maybeSingle();

  const canCreate = ["user", "admin"].includes(membership.role);
  const preparation = settings?.preparation_pence ?? 1000;
  const recipientRate = settings?.recipient_pence ?? 5;
  const input = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-[var(--text-primary)]";
  const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketing"
        title="Email campaigns"
        subtitle="Prepare campaigns for manager approval and keep a record of activity."
      />
      <section className="space-y-6 p-6 lg:p-10">
        <Link href="/marketing" className="text-sm font-semibold text-[var(--accent)]">
          Back to marketing workspace
        </Link>

        {query.error && (
          <p role="alert" className={panel}>
            {errors[query.error] ?? "The request could not be completed."}
          </p>
        )}
        {query.created === "1" && (
          <p role="status" className={panel}>Campaign draft saved.</p>
        )}

        <div className={panel}>
          <h2 className="font-semibold">Campaign preparation</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Draft creation, recipient selection and approval are available. Personalised
            flyer generation and Mailchimp delivery are being added next.
            Campaigns cannot send from this page yet.
          </p>
          {settingsError ? (
            <p role="alert" className="mt-3 text-sm">
              Unable to load internal estimate rates. Draft creation is temporarily unavailable.
            </p>
          ) : (
            <p className="mt-3 text-sm">
              Internal estimate: {money(preparation)} preparation
              {" + "}{money(recipientRate)} per recipient.
              These are internal values, not Mailchimp charges or spending allowances.
            </p>
          )}
        </div>

        {canCreate && !settingsError && (
          <form action={createCampaignDraft} className={panel + " space-y-5"}>
            <h2 className="text-lg font-semibold">Create a campaign draft</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Campaign name
                <input name="name" required maxLength={160}
                  placeholder="Instagrid leasing - construction"
                  className={input} />
              </label>
              <label className="block text-sm font-medium">
                Reply-to email
                <input name="reply_to" type="email" maxLength={254}
                  placeholder="Your monitored sales email"
                  className={input} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Campaign objective
              <textarea name="objective" required maxLength={2000}
                rows={3} placeholder="Who is this for and what result do you want?"
                className={input} />
            </label>
            <label className="block text-sm font-medium">
              Email subject
              <input name="subject" maxLength={160} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Email message
              <textarea name="email_body" maxLength={20000}
                rows={7} className={input} />
            </label>
            <button type="submit"
              className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950">
              Save draft
            </button>
          </form>
        )}

        <div className={panel}>
          <h2 className="text-lg font-semibold">
            {membership.role === "admin" ? "Organisation campaigns" : "Your campaigns"}
          </h2>
          {loadError ? (
            <p role="alert" className="mt-4">Unable to load campaigns. Please refresh.</p>
          ) : !campaigns?.length ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              No campaigns yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {["Campaign", "Status", "Recipients", "Internal estimate", "Created"].map(
                      heading => <th key={heading} className="px-3 py-3">{heading}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(campaign => (
                    <tr key={campaign.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-4">
                        <Link href={`/marketing/campaigns/${campaign.id}`} className="font-semibold text-[var(--accent)] underline underline-offset-4">{campaign.name}</Link>
                        <p className="mt-1 max-w-md whitespace-pre-wrap text-[var(--text-secondary)]">
                          {campaign.objective}
                        </p>
                      </td>
                      <td className="px-3 py-4 capitalize">
                        {campaign.status.replaceAll("_", " ")}
                      </td>
                      <td className="px-3 py-4">{campaign.recipient_count}</td>
                      <td className="px-3 py-4">{money(campaign.internal_estimate_pence)}</td>
                      <td className="px-3 py-4">
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Europe/London",
                          dateStyle: "medium"
                        }).format(new Date(campaign.created_at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-[var(--text-secondary)]">
                Showing up to 100 most recent campaigns.
              </p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}