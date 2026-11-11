import CampaignOfferPreview from "@/components/marketing/CampaignOfferPreview";
import CampaignSubmitButton from "@/components/marketing/CampaignSubmitButton";
import CampaignFeedback from "@/components/marketing/CampaignFeedback";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import { saveCampaignDetail, changeCampaignStatus } from "../detail-actions";

const money = (value: number | string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })
    .format(Number(value) / 100);

export default async function CampaignDetail({
  params, searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns").select("*").eq("id", id).maybeSingle();

  if (campaignError) {
    return <AppShell><div className="p-8" role="alert">
      Unable to load campaign. Please refresh.
    </div></AppShell>;
  }
  if (!campaign) notFound();

  const [
    { data: membership, error: membershipError },
    { data: recipients, error: recipientError },
    { data: audit, error: auditError }
  ] = await Promise.all([
    supabase.from("organisation_members").select("role")
      .eq("organisation_id", campaign.organisation_id)
      .eq("user_id", user.id).eq("active", true).maybeSingle(),
    supabase.from("email_campaign_recipients")
      .select("id,company_id,email,contact_name,company_name,source,eligibility_note")
      .eq("campaign_id", id).order("id").range(0, 4000),
    supabase.from("email_campaign_audit")
      .select("id,action,revision,details,created_at,actor_id")
      .eq("campaign_id", id).order("created_at", { ascending: false }).limit(30)
  ]);

  const owner = campaign.created_by === user.id;
  const editable = owner && ["draft", "returned"].includes(campaign.status)
    && ["user", "admin"].includes(membership?.role ?? "");
  const canReview = membership?.role === "admin"
    && campaign.status === "pending_approval";

  // Always include previously selected CRM records, even beyond the picker limit.
  const selectedIds = [...new Set(
    (recipients ?? []).filter(r => r.source === "crm" && r.company_id)
      .map(r => String(r.company_id))
  )];

  const { data: picker, error: pickerError } = editable
    ? await supabase.from("companies")
      .select("id,company_name,contact_name,email,industry")
      .eq("organisation_id", campaign.organisation_id)
      .not("email", "is", null).order("company_name").limit(501)
    : { data: [], error: null };

  const missingIds = selectedIds.filter(
    selected => !(picker ?? []).some(company => company.id === selected)
  );
  const { data: extra, error: extraError } = editable && missingIds.length
    ? await supabase.from("companies")
      .select("id,company_name,contact_name,email,industry")
      .eq("organisation_id", campaign.organisation_id).in("id", missingIds)
    : { data: [], error: null };

  const companies = [...(picker ?? []).slice(0, 500), ...(extra ?? [])];
  // Include the 501st item if it was already selected.
  for (const company of picker ?? []) {
    if (selectedIds.includes(company.id) &&
        !companies.some(item => item.id === company.id)) companies.push(company);
  }

  const missingSelected = selectedIds.some(
    selected => !companies.some(company => company.id === selected)
  );
  const loadFailed = !!(membershipError || recipientError ||
    (editable && (pickerError || extraError || missingSelected)));
  const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6";
  const input = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3";
  const button = "rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950";
  const secondary = "rounded-xl border border-[var(--border)] px-4 py-3 font-semibold";
  const importedCount = (recipients ?? []).filter(r => r.source === "csv").length;

  function identity() {
    return <>
      <input type="hidden" name="campaign_id" value={id} />
      <input type="hidden" name="revision" value={campaign.revision} />
    </>;
  }

  return <AppShell>
    <PageHeader eyebrow="Email campaign" title={campaign.name}
      subtitle={`Status: ${campaign.status.replaceAll("_", " ")} | Revision ${campaign.revision}`} />
    <section className="space-y-6 p-6 lg:p-10">
      <Link href="/marketing/campaigns" className="font-semibold text-[var(--accent)]">
        Back to campaigns
      </Link>

      <CampaignFeedback
        error={query.error}
        message={query.message}
        status={campaign.status}
        revision={campaign.revision}
        updatedAt={campaign.updated_at}
      />
      {loadFailed && <p role="alert" className={panel}>
        Some campaign data could not be loaded. Refresh before editing or reviewing.
      </p>}

      <div className={panel}>
        <p className="text-lg font-semibold">
          {campaign.recipient_count} recipients | Internal estimate {money(campaign.internal_estimate_pence)}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {money(campaign.internal_preparation_pence)} preparation plus
          {" "}{money(campaign.internal_recipient_pence)} per recipient.
          Internal values only; not additional Mailchimp charges.
        </p>
        <p className="mt-2 text-sm">
          Delivery is not connected yet. Approval records a decision and does not send email.
        </p>
        {campaign.review_note && <p className="mt-4 whitespace-pre-wrap">
          Review note: {campaign.review_note}
        </p>}
      </div>

      {editable && !loadFailed ? (
        <form action={saveCampaignDetail} className={panel + " space-y-5"}>
          {identity()}
          <h2 className="text-lg font-semibold">Edit draft and recipients</h2>
          <label className="block text-sm">Campaign name
            <input name="name" required maxLength={160} defaultValue={campaign.name} className={input} />
          </label>
          <label className="block text-sm">Objective
            <textarea name="objective" required maxLength={2000} rows={3}
              defaultValue={campaign.objective} className={input} />
          </label>
          <label className="block text-sm">Reply-to email
            <input name="reply_to" type="email" required maxLength={254}
              defaultValue={campaign.reply_to} className={input} />
          </label>
          <label className="block text-sm">Subject
            <input name="subject" required maxLength={160}
              defaultValue={campaign.subject} className={input} />
          </label>
          <label className="block text-sm">Email message
            <textarea name="email_body" required maxLength={20000} rows={8}
              defaultValue={campaign.email_body} className={input} />
          </label>

          <fieldset className="space-y-3">
            <legend className="font-semibold">CRM recipients</legend>
            <p className="text-sm text-[var(--text-secondary)]">
              Tick contacts to include. Unticking removes them when saved.
              Showing the first 500 companies with an email, plus existing selections.
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-3">
              {companies.map(company => (
                <label key={company.id} className="flex items-start gap-3 rounded-lg p-2">
                  <input type="checkbox" name="crm_ids" value={company.id}
                    defaultChecked={selectedIds.includes(company.id)} className="mt-1" />
                  <span className="text-sm">
                    <span className="block font-semibold">{company.company_name}</span>
                    <span>{company.contact_name || "No contact name"} | {company.email}</span>
                    {company.industry && <span className="block text-xs">{company.industry}</span>}
                  </span>
                </label>
              ))}
              {!companies.length && <p className="text-sm">No CRM contacts with emails found.</p>}
            </div>
          </fieldset>

          <div className="space-y-2">
            <a
              href="/templates/mlt-campaign-test.csv"
              download="mlt-campaign-test.csv"
              className="inline-flex rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--accent)]"
            >
              Download CSV template
            </a>
            <p className="text-sm text-[var(--text-secondary)]">
              Includes Lucas's test email. Replace the sample row with your recipients before a real campaign.
            </p>
          </div>

          <label className="block text-sm">Upload CSV
            <input type="file" name="csv" accept=".csv,text/csv" className={input} />
          </label>
          <p className="text-sm text-[var(--text-secondary)]">
            Required header: email. Optional headers: contact_name, company_name.
            Maximum 2,000 rows and 300 KB. A new upload replaces the previous imported list.
            CRM selections are retained separately. Duplicate addresses are combined.
          </p>
          <p className="text-sm">{importedCount} imported recipients currently saved.</p>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="remove_imported" value="yes" />
            Remove existing imported recipients if no replacement file is uploaded
          </label>

          <label className="block text-sm">Recipient source and eligibility
            <textarea name="eligibility_note" required maxLength={2000} rows={3}
              defaultValue={recipients?.[0]?.eligibility_note ?? ""}
              placeholder="Explain where these contacts came from and why they are eligible for this campaign."
              className={input} />
          </label>
          <p className="text-sm text-[var(--text-secondary)]">
            This note records your assessment. It does not automatically establish permission
            or confirm the email provider accepts the list.
          </p>
          <CampaignSubmitButton className={button}>Save draft and recipients</CampaignSubmitButton>
          <p className="text-sm">Save changes before submitting for approval below.</p>
        </form>
      ) : (
        <div className={panel + " space-y-4"}>
          <h2 className="font-semibold">Saved campaign for review</h2>
          <p className="whitespace-pre-wrap"><strong>Objective:</strong> {campaign.objective}</p>
          <p><strong>Reply to:</strong> {campaign.reply_to || "Not entered"}</p>
          <p><strong>Subject:</strong> {campaign.subject || "Not entered"}</p>
          <div className="whitespace-pre-wrap rounded-xl border border-[var(--border)] p-4">
            {campaign.email_body || "No message saved."}
          </div>
        </div>
      )}

      <CampaignOfferPreview
        snapshot={campaign.flyer_snapshot}
        revision={campaign.revision}
      />
      {!loadFailed && <div className={panel + " space-y-4"}>
        <h2 className="font-semibold">Approval controls</h2>

        {owner && ["draft", "returned"].includes(campaign.status) && (
          <form action={changeCampaignStatus}>
            {identity()}
            <input type="hidden" name="action" value="submit" />
            <CampaignSubmitButton className={button}>Submit saved campaign for approval</CampaignSubmitButton>
          </form>
        )}

        {canReview && <>
          <form action={changeCampaignStatus} className="space-y-3">
            {identity()}
            <label className="block text-sm">Approval note (optional)
              <textarea name="note" maxLength={2000} rows={2} className={input} />
            </label>
            <input type="hidden" name="action" value="approve" />
            <CampaignSubmitButton className={button}>Approve campaign</CampaignSubmitButton>
          </form>
          <form action={changeCampaignStatus} className="space-y-3">
            {identity()}
            <label className="block text-sm">Changes required
              <textarea name="note" required maxLength={2000} rows={3} className={input} />
            </label>
            <input type="hidden" name="action" value="return" />
            <CampaignSubmitButton className={secondary}>Return for changes</CampaignSubmitButton>
          </form>
        </>}

        {owner && ["pending_approval", "approved", "returned"].includes(campaign.status) && (
          <form action={changeCampaignStatus}>
            {identity()}
            <input type="hidden" name="action" value="reopen" />
            <CampaignSubmitButton className={secondary}>
              Reopen as draft (requires approval again)
            </CampaignSubmitButton>
          </form>
        )}

        {(owner || membership?.role === "admin") &&
          ["draft", "returned", "pending_approval", "approved"].includes(campaign.status) && (
          <form action={changeCampaignStatus}>
            {identity()}
            <input type="hidden" name="action" value="cancel" />
            <CampaignSubmitButton className={secondary}>Cancel campaign</CampaignSubmitButton>
          </form>
        )}

        {owner && membership?.role !== "admin" && campaign.status === "pending_approval" &&
          <p className="text-sm">Waiting for another organisation admin to review.</p>}
        {campaign.status === "approved" &&
          <p className="text-sm">Approved. Sending will become available after delivery setup.</p>}
      </div>}

      <details className={panel}>
        <summary className="cursor-pointer font-semibold">
          Saved recipients ({recipients?.length ?? 0})
        </summary>
        {recipientError ? <p role="alert">Unable to load recipients.</p> : (
          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
            {recipients?.map(recipient => <div key={recipient.id}
              className="border-b border-[var(--border)] pb-3 text-sm">
              <p className="font-semibold">{recipient.email}</p>
              <p>{recipient.company_name} | {recipient.contact_name} | {recipient.source}</p>
              <p className="mt-1 whitespace-pre-wrap">{recipient.eligibility_note}</p>
            </div>)}
          </div>
        )}
      </details>

      <div className={panel}>
        <h2 className="font-semibold">Recent campaign history</h2>
        {auditError ? <p role="alert">Unable to load history.</p> :
          !audit?.length ? <p className="mt-3 text-sm">No recorded changes yet.</p> :
          <div className="mt-4 space-y-4">
            {audit.map(entry => <div key={entry.id} className="border-b border-[var(--border)] pb-3 text-sm">
              <p className="font-semibold capitalize">{entry.action.replaceAll("_", " ")} | Revision {entry.revision}</p>
              <p>{new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short"
              }).format(new Date(entry.created_at))}</p>
              <p className="break-all text-xs text-[var(--text-secondary)]">User: {entry.actor_id}</p>
              {typeof entry.details?.note === "string" && entry.details.note &&
                <p className="mt-2 whitespace-pre-wrap">{entry.details.note}</p>}
            </div>)}
          </div>
        }
      </div>
    </section>
  </AppShell>;
}