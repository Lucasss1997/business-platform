import Link from "next/link";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external services to The Platform.
        </p>
      </div>

      <Link
        href="/settings/integrations/microsoft"
        className="block max-w-xl rounded-xl border p-5 transition hover:bg-muted/40"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Microsoft 365</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send secure CRM emails through your organisation's Microsoft 365 tenant.
            </p>
          </div>

          <span className="rounded-full border px-3 py-1 text-xs">
            Configure
          </span>
        </div>
      </Link>
    </div>
  );
}
