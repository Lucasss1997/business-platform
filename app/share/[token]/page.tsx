import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import ShareAccessClient from "./ShareAccessClient";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{
    token: string;
  }>;
};

function invalidSharePage(
  message = "This share link is invalid or has expired.",
) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
          The Platform
        </p>

        <h1 className="mt-4 text-2xl font-semibold">
          Document unavailable
        </h1>

        <p className="mt-3 leading-7 text-slate-400">
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function SharePage({
  params,
}: SharePageProps) {
  const { token } = await params;

  if (!token) {
    return invalidSharePage();
  }

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const supabase = createAdminClient();

  const { data: share, error } = await supabase
    .from("document_shares")
    .select("id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !share) {
    return invalidSharePage();
  }

  if (share.revoked_at) {
    return invalidSharePage(
      "This document share has been revoked.",
    );
  }

  if (new Date(share.expires_at).getTime() <= Date.now()) {
    return invalidSharePage(
      "This document share has expired.",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <ShareAccessClient token={token} />
      </div>
    </main>
  );
}
