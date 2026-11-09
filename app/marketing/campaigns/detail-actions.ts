"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notifyCampaignApprovers } from "@/lib/campaign-approval-email";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function destination(id: string, message: string, error = true): never {
  redirect(`/marketing/campaigns/${id}?${error ? "error" : "message"}=${encodeURIComponent(message)}`);
}

function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let closed = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else value += c;
    } else if (c === '"' && value === "" && !closed) {
      quoted = true;
    } else if (c === ",") {
      row.push(value); value = ""; closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = []; value = ""; closed = false;
    } else {
      if (closed || c === '"') throw new Error("Invalid CSV quoting.");
      value += c;
    }
  }

  if (quoted) throw new Error("CSV contains an unfinished quoted field.");
  row.push(value);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);
  return rows;
}

export async function saveCampaignDetail(form: FormData) {
  const id = String(form.get("campaign_id") ?? "");
  if (!uuid.test(id)) redirect("/marketing/campaigns");
  const revision = Number(form.get("revision"));
  if (!Number.isSafeInteger(revision) || revision < 1) {
    destination(id, "Refresh the campaign and try again.");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns")
    .select("id,created_by,status,revision")
    .eq("id", id)
    .maybeSingle();

  if (campaignError || !campaign || campaign.created_by !== user.id) {
    destination(id, "You cannot edit this campaign.");
  }
  if (!["draft", "returned"].includes(campaign.status)) {
    destination(id, "Reopen the campaign before editing.");
  }
  if (campaign.revision !== revision) {
    destination(id, "The campaign changed. Refresh before saving.");
  }

  const crmIds = [...new Set(form.getAll("crm_ids").map(String))];
  if (crmIds.length > 2000 || crmIds.some(value => !uuid.test(value))) {
    destination(id, "Select up to 2,000 valid CRM contacts.");
  }

  // Preserve imported contacts unless the user replaces or removes them.
  let imported: Array<{email: string; contact_name: string; company_name: string}> = [];
  const file = form.get("csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > 300000) destination(id, "Use a CSV smaller than 300 KB.");
    try {
      const rows = readCsv((await file.text()).replace(/^\uFEFF/, ""));
      const headers = (rows.shift() ?? []).map(value => value.trim().toLowerCase());
      if (new Set(headers).size !== headers.length) {
        throw new Error("CSV contains duplicate headers.");
      }
      const emailIndex = headers.indexOf("email");
      const nameIndex = headers.indexOf("contact_name");
      const companyIndex = headers.indexOf("company_name");
      if (emailIndex < 0) throw new Error("CSV needs an email column.");
      if (rows.length > 2000) throw new Error("Use up to 2,000 CSV recipients.");

      imported = rows.map((row, index) => {
        if (row.length !== headers.length) {
          throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
        }
        return {
          email: (row[emailIndex] ?? "").trim().toLowerCase(),
          contact_name: nameIndex < 0 ? "" : row[nameIndex].trim(),
          company_name: companyIndex < 0 ? "" : row[companyIndex].trim()
        };
      });
    } catch (error) {
      destination(id, error instanceof Error ? error.message : "Unable to read CSV.");
    }
  } else if (form.get("remove_imported") !== "yes") {
    const { data, error } = await supabase
      .from("email_campaign_recipients")
      .select("email,contact_name,company_name")
      .eq("campaign_id", id)
      .eq("source", "csv")
      .order("id")
      .range(0, 2000);
    if (error) destination(id, "Unable to preserve imported recipients.");
    imported = data ?? [];
  }

  const { error } = await supabase.rpc("save_email_campaign_draft", {
    p_campaign_id: id,
    p_revision: revision,
    p_name: String(form.get("name") ?? "").trim(),
    p_objective: String(form.get("objective") ?? "").trim(),
    p_subject: String(form.get("subject") ?? "").trim(),
    p_body: String(form.get("email_body") ?? ""),
    p_reply_to: String(form.get("reply_to") ?? "").trim(),
    p_crm_ids: crmIds,
    p_upload_recipients: imported,
    p_eligibility_note: String(form.get("eligibility_note") ?? "").trim()
  });

  if (error) destination(id, error.message);
  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${id}`);
  destination(id, "Draft and recipients saved.", false);
}

export async function changeCampaignStatus(form: FormData) {
  const id = String(form.get("campaign_id") ?? "");
  if (!uuid.test(id)) redirect("/marketing/campaigns");
  const revision = Number(form.get("revision"));
  const action = String(form.get("action") ?? "");
  if (!Number.isSafeInteger(revision) || revision < 1 ||
      !["submit", "approve", "return", "reopen", "cancel"].includes(action)) {
    destination(id, "Invalid action. Refresh and try again.");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { error } = await supabase.rpc("transition_email_campaign", {
    p_campaign_id: id,
    p_revision: revision,
    p_action: action,
    p_note: String(form.get("note") ?? "").trim()
  });

  if (error) destination(id, error.message);
  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${id}`);
  if (action === "submit") {
    let notified = false;

    try {
      const result = await notifyCampaignApprovers(id, revision);
      notified = result.ok;
    } catch {
      console.error("Approval notification processing failed.");
    }

    destination(
      id,
      notified
        ? "Submitted for approval. Microsoft accepted the admin notification."
        : "Submitted for approval, but the admin email was not confirmed. Check notification records and Microsoft Sent Items.",
      false
    );
  }

  destination(id, "Campaign status updated.", false);
}