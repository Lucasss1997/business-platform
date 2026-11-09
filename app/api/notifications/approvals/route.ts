import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createClient();
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json(
      { enabled: false, count: 0, items: [] },
      { status: 401, headers }
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError) {
    return Response.json(
      { error: "Unable to check notification access." },
      { status: 503, headers }
    );
  }

  if (!membership || membership.role !== "admin") {
    return Response.json(
      { enabled: false, count: 0, items: [] }, { headers }
    );
  }

  const { data, count, error } = await supabase
    .from("email_campaigns")
    .select("id,name,recipient_count,internal_estimate_pence,submitted_at", {
      count: "exact"
    })
    .eq("organisation_id", membership.organisation_id)
    .eq("status", "pending_approval")
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (error) {
    return Response.json(
      { error: "Unable to load approval notifications." },
      { status: 503, headers }
    );
  }

  return Response.json({
    enabled: true,
    count: count ?? 0,
    items: data ?? []
  }, { headers });
}