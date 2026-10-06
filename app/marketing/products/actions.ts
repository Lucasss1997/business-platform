"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function context(requireAdmin = false) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Please sign in again.");

  const { data: member, error: memberError } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (memberError || !member?.organisation_id) {
    throw new Error("Unable to verify organisation access.");
  }

  if (requireAdmin && member.role !== "admin") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_super_admin) {
      throw new Error("Administrator access is required.");
    }
  }

  return { supabase, organisationId: member.organisation_id };
}

export async function registerProductPhoto(form: FormData) {
  let failure = "";

  try {
    const { supabase, organisationId } = await context(true);
    const id = String(form.get("productId") || "");
    const file = form.get("photo");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Invalid product.");
    }
    if (form.get("approved") !== "on") {
      throw new Error("Confirm the photograph has been checked.");
    }
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) {
      throw new Error("Choose a PNG product photograph up to 5 MB.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (
      file.type !== "image/png" ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    ) {
      throw new Error("The product photograph must be a PNG.");
    }

    const { data: product, error: productError } = await supabase
      .from("marketing_product_profiles")
      .select("catalogue_item_id")
      .eq("catalogue_item_id", id)
      .eq("organisation_id", organisationId)
      .single();

    if (productError || !product) throw new Error("Product not available.");

    const admin = createAdminClient();
    const { data: bucket, error: bucketError } = await admin.storage
      .getBucket("marketing-images");

    if (bucketError || !bucket || bucket.public) {
      throw new Error("Private marketing image storage is unavailable.");
    }

    const path = `${organisationId}/products/${id}/${randomUUID()}.png`;
    const { error: uploadError } = await admin.storage
      .from("marketing-images")
      .upload(path, bytes, { contentType: "image/png", upsert: false });

    if (uploadError) throw new Error("Unable to save the photograph.");

    const { data: updated, error: updateError } = await supabase
      .from("marketing_product_profiles")
      .update({ image_path: path, image_approved: true })
      .eq("catalogue_item_id", id)
      .eq("organisation_id", organisationId)
      .select("catalogue_item_id")
      .single();

    if (updateError || !updated) {
      await admin.storage.from("marketing-images").remove([path]);
      throw new Error("Unable to register the photograph.");
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "Photo registration failed.";
  }

  if (failure) {
    redirect(`/marketing/products?message=${encodeURIComponent(failure)}`);
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/products");
  redirect("/marketing/products?message=Product%20photograph%20approved.");
}

export async function getMarketingProductPhoto(id: string) {
  const { supabase, organisationId } = await context();

  const { data: profile, error } = await supabase
    .from("marketing_product_profiles")
    .select("image_path, image_approved, brand")
    .eq("organisation_id", organisationId)
    .eq("catalogue_item_id", id)
    .eq("marketing_enabled", true)
    .single();

  if (error || !profile?.image_approved || !profile.image_path) {
    throw new Error("This product needs an approved photograph. No generation request was sent.");
  }

  if (!profile.image_path.startsWith(`${organisationId}/products/${id}/`)) {
    throw new Error("Product photograph mapping needs checking.");
  }

  const { data: item, error: itemError } = await supabase
    .from("catalogue_items")
    .select("name")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .single();

  if (itemError || !item) throw new Error("Product is no longer available.");

  const admin = createAdminClient();
  const { data: photo, error: photoError } = await admin.storage
    .from("marketing-images")
    .download(profile.image_path);

  if (photoError || !photo || photo.size > 5 * 1024 * 1024 || photo.type !== "image/png") {
    throw new Error("Unable to load the approved product photograph.");
  }

  return {
    name: item.name as string,
    brand: profile.brand as string,
    photo: `data:image/png;base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`
  };
}