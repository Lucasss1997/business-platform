"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { approveKnowledge } from "@/app/marketing/knowledge/actions";

const field =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--text-primary)]";

export default function KnowledgeForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");

    try {
      const result = await approveKnowledge(data);
      setMessage(result.message);
      if (result.success) form.reset();
    } catch {
      setMessage("Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}
      className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">Approve information</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        Add one verified fact per entry. Include conditions and limitations in the fact.
        Use an expiry date for time-sensitive information.
      </p>

      <fieldset disabled={busy} className="space-y-5">
        <label className="block text-sm font-medium">
          Brand
          <select name="brand" className={field}>
            <option>MLT Consultants</option>
            <option>Fuel Save Group</option>
            <option>OC Digital</option>
          </select>
        </label>

        <label className="block text-sm font-medium">
          Title
          <input name="title" required maxLength={200} className={field}
            placeholder="e.g. Battery operating specification" />
        </label>

        <label className="block text-sm font-medium">
          Verified fact
          <textarea name="content" required maxLength={4000} rows={5}
            className={field}
            placeholder="Enter the exact information approved for marketing use." />
        </label>

        <label className="block text-sm font-medium">
          Source reference
          <textarea name="source" required maxLength={1000} rows={2}
            className={field}
            placeholder="Document title/version/page, source URL, or dated internal confirmation" />
        </label>

        <label className="block text-sm font-medium">
          Valid until (optional)
          <input type="date" name="validUntil" className={field} />
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirmed" required className="mt-1" />
          <span>I have checked the source and approve this fact for marketing use.</span>
        </label>

        <button type="submit"
          className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving..." : "Approve and save"}
        </button>
      </fieldset>

      <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>
    </form>
  );
}