"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type KnowledgeResult = {
  success: boolean;
  message: string;
};

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Please sign in again.");

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error("Unable to verify organisation access.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (membership.role !== "admin" && !profile?.is_super_admin) {
    throw new Error("Organisation admin access is required.");
  }

  return { supabase, user, organisationId: membership.organisation_id };
}

export async function approveKnowledge(form: FormData): Promise<KnowledgeResult> {
  try {
    const { supabase, user, organisationId } = await getAdminContext();

    const brand = String(form.get("brand") || "");
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    const source = String(form.get("source") || "").trim();
    const validUntil = String(form.get("validUntil") || "");
    const confirmed = form.get("confirmed") === "on";

    if (!["MLT Consultants", "Fuel Save Group", "OC Digital"].includes(brand)) {
      return { success: false, message: "Select a valid brand." };
    }

    if (
      !title || title.length > 200 ||
      !content || content.length > 4000 ||
      !source || source.length > 1000 ||
      !confirmed
    ) {
      return { success: false, message: "Complete the required fields and confirm approval." };
    }

    if (validUntil) {
      const parsed = new Date(`${validUntil}T00:00:00Z`);
      const today = new Date().toISOString().slice(0, 10);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== validUntil ||
        validUntil < today
      ) {
        return { success: false, message: "Expiry must be a valid date today or later." };
      }
    }

    const { error } = await supabase.from("marketing_knowledge").insert({
      organisation_id: organisationId,
      brand,
      title,
      content,
      source_reference: source,
      valid_until: validUntil || null,
      approved_by: user.id
    });

    if (error) {
      console.error("Marketing knowledge approval failed:", error);
      return { success: false, message: "Could not save the approved information. Please try again." };
    }

    revalidatePath("/marketing/knowledge");
    return { success: true, message: "Information approved and saved." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Approval failed."
    };
  }
}

export async function withdrawKnowledge(form: FormData) {
  const { supabase, organisationId } = await getAdminContext();
  const id = String(form.get("id") || "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid information record.");
  }

  const { data, error } = await supabase
    .from("marketing_knowledge")
    .update({ active: false })
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .select("id");

  if (error || !data?.length) {
    throw new Error("Could not withdraw this information. Refresh and try again.");
  }

  revalidatePath("/marketing/knowledge");
}
export async function approveStarterFacts() {
  const { supabase, user, organisationId } = await getAdminContext();

  const facts = [
    {
      title: "Hussh Pod 10/20 — usable battery energy",
      content: "The Hussh Pod 10/20 has 20 kWh of usable battery energy.",
      source_reference: "Hussh_Pod_10-20_V1_06_26.pdf, pages 1–2; corroborated by Distribution Pricing 2026, purchase table."
    },
    {
      title: "Hussh Pod 10/20 — inverter output",
      content: "The Hussh Pod 10/20 has a rated inverter output of 10 kVA. This is an apparent-power rating and must not be described as 10 kW.",
      source_reference: "Hussh_Pod_10-20_V1_06_26.pdf, pages 1–2; corroborated by Distribution Pricing 2026, purchase table."
    },
    {
      title: "Hussh Pod 30/45 — usable battery energy",
      content: "The Hussh Pod 30/45 has 45 kWh of usable battery energy.",
      source_reference: "Hussh_Pod_30-45_V1_06_26.pdf, pages 1–2; corroborated by Distribution Pricing 2026, purchase table."
    },
    {
      title: "Hussh Pod 150/150 — usable battery energy",
      content: "The Hussh Pod 150/150 has 150 kWh of usable battery energy.",
      source_reference: "Hussh_Pod_150-150_V1_06_26.pdf, page 1; corroborated by Distribution Pricing 2026, purchase table."
    }
  ];

  const { data: existing, error: readError } = await supabase
    .from("marketing_knowledge")
    .select("title, content, source_reference, valid_until")
    .eq("organisation_id", organisationId)
    .eq("brand", "MLT Consultants")
    .eq("active", true)
    .in("title", facts.map((fact) => fact.title));

  if (readError) throw new Error("Unable to check existing product facts.");

  const today = new Date().toISOString().slice(0, 10);
  const missing = facts.filter((fact) =>
    !existing?.some((record) =>
      record.title === fact.title &&
      record.content === fact.content &&
      record.source_reference === fact.source_reference &&
      (!record.valid_until || record.valid_until >= today)
    )
  );

  if (missing.length) {
    const { error } = await supabase.from("marketing_knowledge").insert(
      missing.map((fact) => ({
        ...fact,
        organisation_id: organisationId,
        brand: "MLT Consultants",
        approved_by: user.id
      }))
    );

    if (error) {
      console.error("Starter facts import failed:", error);
      throw new Error("Unable to approve the product facts. Please try again.");
    }
  }

  revalidatePath("/marketing/knowledge");
}