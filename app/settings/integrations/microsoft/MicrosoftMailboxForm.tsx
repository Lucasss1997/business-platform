"use client";

import { useState } from "react";

type Props = {
  initialEmail: string;
};

export default function MicrosoftMailboxForm({ initialEmail }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function saveMailbox() {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/integrations/microsoft/mailbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ senderEmail: email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save mailbox.");
      }

      setStatus("Mailbox saved.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save mailbox."
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    setSending(true);
    setStatus(null);

    try {
      const response = await fetch(
        "/api/integrations/microsoft/test-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "Could not send test email."
        );
      }

      setStatus(`Test email sent to ${recipientEmail}.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not send test email."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Sending mailbox
        </label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sales@example.com"
          className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={saveMailbox}
          disabled={saving}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          {saving ? "Saving..." : "Save mailbox"}
        </button>
      </div>

      <div className="border-t pt-5">
        <label className="block text-sm font-medium">
          Send test email
        </label>

        <p className="mt-1 text-sm text-muted-foreground">
          Confirm Microsoft Graph can send through this mailbox.
        </p>

        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-3 w-full max-w-md rounded-lg border px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={sendTestEmail}
          disabled={sending || !recipientEmail}
          className="mt-3 block rounded-lg border px-4 py-2 text-sm font-medium"
        >
          {sending ? "Sending..." : "Send test email"}
        </button>
      </div>

      {status && (
        <div className="text-sm text-muted-foreground">
          {status}
        </div>
      )}
    </div>
  );
}
