"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteUserForm() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/organisation/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          email,
          role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The invitation could not be sent.");
      }

      setMessage(`Invitation sent to ${result.email}.`);
      setDisplayName("");
      setEmail("");
      setRole("user");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The invitation could not be sent."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="font-semibold text-[var(--text-primary)]">
          Invite user
        </h2>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          The user will receive a branded welcome email with a secure account setup link.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Full name"
            required
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5">
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Sending invitation..." : "Send invitation"}
        </button>
      </div>
    </form>
  );
}