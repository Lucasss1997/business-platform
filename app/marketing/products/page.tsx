import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import { getMarketingProducts } from "@/app/marketing/product-actions";
import { registerProductPhoto } from "./actions";

export default async function ProductPhotosPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("organisation_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "admin" && !profile?.is_super_admin)) {
    redirect("/marketing");
  }

  const products = await getMarketingProducts();
  const { message } = await searchParams;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketing"
        title="Product photographs"
        subtitle="Register checked product photographs once for the sales team."
      />
      <section className="space-y-5 p-6 lg:p-10">
        <Link href="/marketing" className="text-sm font-semibold underline">
          Back to marketing
        </Link>
        {message && <p role="status">{message}</p>}
        <p className="text-sm text-[var(--text-secondary)]">
          Use a transparent PNG up to 5 MB. Check the exact model,
          physical details, labels and image rights. Remove manufacturer
          contact details before approving.
        </p>
        {products.map((product) => (
          <form key={product.id} action={registerProductPhoto}
            className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <input type="hidden" name="productId" value={product.id} />
            <div>
              <h2 className="font-semibold">{product.name}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {product.brand} · {product.group} · {product.photoReady ? "Photo approved" : "Photo pending"}
              </p>
            </div>
            <label className="block text-sm">
              Product photograph
              <input type="file" name="photo" accept="image/png" required
                className="mt-2 block w-full" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="approved" required className="mt-1" />
              <span>
                I have checked this against the original photograph.
                It shows the correct model, is permitted for our marketing,
                and contains no manufacturer contact details.
              </span>
            </label>
            <button type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Save and approve photograph
            </button>
          </form>
        ))}
      </section>
    </AppShell>
  );
}