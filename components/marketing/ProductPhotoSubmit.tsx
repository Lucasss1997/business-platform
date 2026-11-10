"use client";

import { useFormStatus } from "react-dom";

export default function ProductPhotoSubmit() {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending && (
          <svg aria-hidden="true" viewBox="0 0 24 24"
            className="h-4 w-4 animate-spin" fill="none">
            <circle cx="12" cy="12" r="9"
              stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M12 3a9 9 0 0 1 9 9"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {pending ? "Uploading and saving..." : "Save and approve photograph"}
      </button>

      <p role="status" aria-live="polite"
        className="text-sm text-[var(--text-secondary)]">
        {pending
          ? "Your photograph is being uploaded and checked. Please keep this page open."
          : ""}
      </p>
    </div>
  );
}