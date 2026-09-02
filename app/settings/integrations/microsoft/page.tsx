import { createClient } from "@/lib/supabase/server";
import MicrosoftMailboxForm from "./MicrosoftMailboxForm";

export default async function MicrosoftIntegrationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let integration = null;

  if (user) {
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (membership?.organisation_id) {
      const { data } = await supabase
        .from("organisation_integrations")
        .select("*")
        .eq("organisation_id", membership.organisation_id)
        .eq("provider", "microsoft")
        .maybeSingle();

      integration = data;
    }
  }

  const connected = integration?.status === "connected";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Microsoft 365</h1>
        <p className="text-sm text-muted-foreground">
          Connect your organisation&apos;s Microsoft 365 tenant to The Platform.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="font-semibold">Microsoft 365 connection</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Allow The Platform to send CRM and document-share emails through
              your organisation.
            </p>
          </div>

          <span className="rounded-full border px-3 py-1 text-xs">
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {connected ? (
          <div className="mt-6 space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">
                Microsoft tenant
              </div>
              <div className="text-sm font-medium">
                {integration.external_tenant_id}
              </div>
            </div>

            <MicrosoftMailboxForm
              initialEmail={
                integration.sender_email || ""
              }
            />
          </div>
        ) : (
          <a
            href="/api/integrations/microsoft/connect"
            className="mt-6 inline-block rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Connect Microsoft 365
          </a>
        )}
      </div>
    </div>
  );
}

