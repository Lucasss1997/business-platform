import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


import CampaignSubmitButton from "@/components/marketing/CampaignSubmitButton";
import { sendMailchimpTest } from "./actions";

export default async function MailchimpSettings({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id,role")
    .eq("user_id", user.id).eq("active", true).maybeSingle();

  if (membershipError || membership?.role !== "admin") {
    return <><p role="alert" className="p-8">
      Organisation admin access is required.
    </p></>;
  }

  const { data: campaigns, error } = await supabase
    .from("email_campaigns").select("id,name,status")
    .eq("organisation_id", membership.organisation_id)
    .order("created_at", { ascending: false }).limit(50);

  const configured = Boolean(
    process.env.MAILCHIMP_API_KEY &&
    process.env.MAILCHIMP_SERVER_PREFIX &&
    process.env.MAILCHIMP_AUDIENCE_ID &&
    process.env.MAILCHIMP_FROM_EMAIL &&
    process.env.MAILCHIMP_FROM_NAME
  );
  const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6";

  return <>
    <div className="px-6 pt-6 lg:px-10 lg:pt-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
        Integrations
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Mailchimp</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Test the email connection before enabling customer campaigns.
      </p>
    </div>
    <section className="space-y-6 p-6 lg:p-10">
      <Link href="/marketing/campaigns"
        className="font-semibold text-[var(--accent)]">Back to campaigns</Link>

      {query.error && <p role="alert" className={panel}>{query.error.slice(0, 1000)}</p>}
      {query.message && <p role="status" className={panel}>{query.message.slice(0, 1000)}</p>}

      <div className={panel}>
        <h2 className="font-semibold">
          {configured ? "Environment settings present" : "Environment settings incomplete"}
        </h2>
        <p className="mt-2 text-sm">
          Sender: {process.env.MAILCHIMP_FROM_NAME || "Not configured"}
          {" â€” "}{process.env.MAILCHIMP_FROM_EMAIL || "Not configured"}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Test recipient: lucas.stephenson@icloud.com.
          This checks delivery only. It does not send your saved campaign content.
        </p>
      </div>

      {error ? <p role="alert">Unable to load campaigns.</p> :
        configured && campaigns?.length ? (
        <form action={sendMailchimpTest} className={panel + " space-y-5"}>
          <label className="block text-sm font-medium">
            Record this test against a campaign
            <select name="campaign_id" required
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>
                {campaign.name} â€” {campaign.status.replaceAll("_", " ")}
              </option>)}
            </select>
          </label>
          <p className="text-sm">
            Creates a test-only draft in Mailchimp with no customer audience selected.
            Sends one test to Lucas. Allow a minute between tests.
          </p>
          <CampaignSubmitButton
            className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950">
            Send connection test to Lucas
          </CampaignSubmitButton>
        </form>
      ) : <p className={panel}>
        Check the environment settings and create a Portal campaign before testing.
      </p>}
    </section>
  </>;
}