import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organisation, branding and integrations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/settings/organisation/branding"
          className="rounded-xl border p-5 transition hover:bg-muted/40"
        >
          <h2 className="font-semibold">Organisation branding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your master logo, brand colour and customer-facing identity.
          </p>
        </Link>

        <Link
          href="/settings/integrations"
          className="rounded-xl border p-5 transition hover:bg-muted/40"
        >
          <h2 className="font-semibold">Integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Microsoft 365 and other services.
          </p>
        </Link>
      </div>
    </div>
  );
}
