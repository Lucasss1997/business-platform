import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import KnowledgeForm from "@/components/marketing/KnowledgeForm";
import { withdrawKnowledge, approveStarterFacts } from "./actions";

export default async function MarketingKnowledgePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError) throw new Error("Unable to verify organisation access.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  const canManage = !!membership &&
    (membership.role === "admin" || profile?.is_super_admin === true);

  const result = membership
    ? await supabase
        .from("marketing_knowledge")
        .select("id, brand, title, content, source_reference, valid_until, active, approved_at")
        .eq("organisation_id", membership.organisation_id)
        .order("approved_at", { ascending: false })
    : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketing"
        title="Approved information"
        subtitle="Verified facts available for marketing drafts, with their sources and validity."
      />
      <section className="space-y-6 p-6 lg:p-10">
        <Link href="/marketing" className="text-sm font-semibold underline">
          Back to content drafting
        </Link>

        {!membership ? (
          <p>No active organisation is available.</p>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {canManage && (
              <div className="space-y-6">
                <form action={approveStarterFacts}
                  className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <h2 className="font-semibold">Manufacturer starter facts</h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Approve four source-checked facts for MLT Consultants:
                    10/20 usable energy (20 kWh), 10/20 output (10 kVA),
                    30/45 usable energy (45 kWh), and 150/150 usable energy (150 kWh).
                    Each record includes its document reference.
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Clicking approves these facts under your account.
                    Existing matching active records are skipped.
                    Withdrawn records remain in the history.
                  </p>
                  <button type="submit"
                    className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                    Approve and import starter facts
                  </button>
                </form>
                <KnowledgeForm />
              </div>
            )}

            <div className="space-y-4">
              {!canManage && (
                <p className="text-sm text-[var(--text-secondary)]">
                  Your organisation admins manage approved information.
                </p>
              )}

              {result?.error ? (
                <p role="alert">Unable to load approved information. Please refresh.</p>
              ) : !result?.data?.length ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  No approved information is available yet.
                </div>
              ) : result.data.map((item) => {
                const expired = item.valid_until && item.valid_until < today;
                const status = !item.active ? "Withdrawn" : expired ? "Expired" : "Approved";

                return (
                  <article key={item.id}
                    className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-[var(--text-secondary)]">{item.brand}</span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">
                        {status}
                      </span>
                    </div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                    <p className="whitespace-pre-wrap break-words text-xs text-[var(--text-secondary)]">
                      Source: {item.source_reference}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Approved: {new Date(item.approved_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}
                      {" | "}Valid until: {item.valid_until || "No expiry"}
                    </p>

                    {canManage && item.active && (
                      <form action={withdrawKnowledge}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit"
                          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                          Withdraw from use
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}