"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  action: "revoke-invite" | "remove-user";
  userId?: string;
  invitationId?: string;
  disabled?: boolean;
};

export default function UserAccessActions({
  action,
  userId,
  invitationId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = action === "revoke-invite";

  async function runAction() {
    const message = revoke
      ? "Revoke this invitation? The setup link will no longer be usable."
      : "Remove this user's access to the organisation?";

    if (!window.confirm(message)) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response = await fetch("/api/organisation/users/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          userId,
          invitationId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The action could not be completed."
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The action could not be completed."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={runAction}
        disabled={working || disabled}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {working
          ? "Working..."
          : revoke
            ? "Revoke invitation"
            : "Remove access"}
      </button>

      {error && (
        <div className="max-w-64 text-right text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}