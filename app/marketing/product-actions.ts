"use server";

import { createClient } from "@/lib/supabase/server";

export async function getMarketingProducts() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Please sign in again.");

  const { data: membership, error: memberError } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (memberError || !membership?.organisation_id) {
    throw new Error("Unable to verify organisation access.");
  }

  const organisationId = membership.organisation_id;
  const { data: profiles, error: profileError } = await supabase
    .from("marketing_product_profiles")
    .select("catalogue_item_id, brand, display_group, sort_order, image_approved, image_path")
    .eq("organisation_id", organisationId)
    .eq("marketing_enabled", true)
    .order("sort_order");

  if (profileError) throw new Error("Unable to load marketing product profiles.");
  if (!profiles?.length) return [];

  const { data: items, error: itemError } = await supabase
    .from("catalogue_items")
    .select("id, name")
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .in("id", profiles.map((profile) => profile.catalogue_item_id));

  if (itemError) throw new Error("Unable to load catalogue products.");

  const names = new Map((items ?? []).map((item) => [item.id, item.name]));
  return profiles
    .filter((profile) => names.has(profile.catalogue_item_id))
    .map((profile) => ({
      id: profile.catalogue_item_id as string,
      name: names.get(profile.catalogue_item_id) as string,
      brand: profile.brand as string,
      group: profile.display_group as string,
      order: profile.sort_order as number,
      photoReady: Boolean(profile.image_approved && profile.image_path),
    }));
}