"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createCampaignDraft(form: FormData) {
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
    redirect("/marketing/campaigns?error=access");
  }

  if (!["user", "admin"].includes(membership.role)) {
    redirect("/marketing/campaigns?error=permission");
  }

  const read = (key: string) => String(form.get(key) ?? "").trim();
  const name = read("name");
  const objective = read("objective");
  const subject = read("subject");
  const emailBody = read("email_body");
  const replyTo = read("reply_to");

  if (
    !name || name.length > 160 ||
    !objective || objective.length > 2000 ||
    subject.length > 160 ||
    emailBody.length > 20000 ||
    replyTo.length > 254 ||
    (replyTo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo))
  ) {
    redirect("/marketing/campaigns?error=validation");
  }

  // Derive identity, organisation, status and rates on the server.
  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin
    .from("email_campaign_settings")
    .select("preparation_pence, recipient_pence")
    .eq("organisation_id", membership.organisation_id)
    .maybeSingle();

  if (settingsError) {
    redirect("/marketing/campaigns?error=settings");
  }

  const { error } = await admin.from("email_campaigns").insert({
    organisation_id: membership.organisation_id,
    created_by: user.id,
    name,
    objective,
    subject,
    email_body: emailBody,
    reply_to: replyTo,
    status: "draft",
    recipient_count: 0,
    internal_preparation_pence: settings?.preparation_pence ?? 1000,
    internal_recipient_pence: settings?.recipient_pence ?? 5
  });

  if (error) {
    console.error("Campaign draft creation failed:", error.code);
    redirect("/marketing/campaigns?error=save");
  }

  revalidatePath("/marketing/campaigns");
  redirect("/marketing/campaigns?created=1");
}