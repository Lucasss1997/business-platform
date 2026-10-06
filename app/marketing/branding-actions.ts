"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const brandKeys: Record<string, string> = {
  "MLT Consultants": "mlt-consultants",
  "Fuel Save Group": "fuel-save-group",
  "OC Digital": "oc-digital"
};

async function brandingContext(requireAdmin = false) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Please sign in again.");

  const { data: membership, error } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !membership?.organisation_id) {
    throw new Error("Unable to verify organisation access.");
  }

  if (requireAdmin && membership.role !== "admin") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_super_admin) {
      throw new Error("An administrator must save the brand logo.");
    }
  }

  return { supabase, organisationId: membership.organisation_id };
}

export async function getMarketingBranding(brand?: string) {
  if (brand && !brandKeys[brand]) throw new Error("Unsupported campaign brand.");

  const { supabase, organisationId } = await brandingContext();
  const { data: organisation, error } = await supabase
    .from("organisations")
    .select("name, brand_primary_colour, logo_url")
    .eq("id", organisationId)
    .single();

  if (error || !organisation) throw new Error("Unable to load branding.");

  let logo = "";
  const admin = createAdminClient();

  if (brand) {
    const directory = `${organisationId}/marketing-brands`;
    const filename = `${brandKeys[brand]}.png`;
    const bucket = admin.storage.from("organisation-branding");

    const { data: objects, error: listError } = await bucket.list(directory, {
      search: filename,
      limit: 20
    });
    if (listError) throw new Error("Unable to check saved brand logos.");

    if (objects?.some((object) => object.name === filename)) {
      const { data, error: logoError } = await bucket.download(`${directory}/${filename}`);
      if (logoError || !data) throw new Error("Unable to load this brand's saved logo.");
      if (data.size > 2 * 1024 * 1024 || data.type !== "image/png") {
        throw new Error("Invalid saved brand logo.");
      }
      logo = `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
    }
  } else if (organisation.logo_url) {
    // Legacy callers still receive the organisation logo.
    const { data, error: logoError } = await admin.storage
      .from("organisation-branding")
      .download(`${organisationId}/master-logo`);

    if (logoError || !data) throw new Error("Unable to load the organisation logo.");
    if (
      data.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(data.type)
    ) throw new Error("Invalid organisation logo.");

    logo = `data:${data.type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }

  return {
    name: brand || organisation.name,
    colour: /^#[0-9a-f]{6}$/i.test(organisation.brand_primary_colour || "")
      ? organisation.brand_primary_colour
      : "#15304b",
    logo
  };
}

export async function saveMarketingBrandLogo(form: FormData) {
  const brand = String(form.get("brand") || "");
  const key = brandKeys[brand];
  if (!key) throw new Error("Unsupported campaign brand.");

  const { organisationId } = await brandingContext(true);
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.type !== "image/png" ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024
  ) throw new Error("Save a PNG logo up to 2 MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("The selected file is not a valid PNG.");
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("organisation-branding")
    .upload(`${organisationId}/marketing-brands/${key}.png`, bytes, {
      contentType: "image/png",
      upsert: true
    });

  if (error) throw new Error("Unable to save the brand logo.");
  return { message: `${brand} logo saved online for future campaigns.` };
}