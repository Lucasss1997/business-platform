"use client";

import { FormEvent, useState } from "react";

type ShareAccessClientProps = {
  token: string;
};

type VerifiedDocument = {
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
};

export default function ShareAccessClient({
  token,
}: ShareAccessClientProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canRequestAccess, setCanRequestAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [document, setDocument] = useState<VerifiedDocument | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setCanRequestAccess(false);
    setIsChecking(true);

    try {
      const response = await fetch("/api/document-shares/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCanRequestAccess(Boolean(result.canRequestAccess));

        throw new Error(
          result.error || "Access could not be verified.",
        );
      }

      setDocument(result.document);
      setDocumentUrl(result.url);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Access could not be verified.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  if (document && documentUrl) {
    return (
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Access confirmed
        </p>

        <h1 className="mt-4 break-words text-2xl font-semibold">
          {document.title}
        </h1>

        <p className="mt-2 break-words text-sm text-slate-400">
          {document.fileName}
        </p>

        {document.description && (
          <p className="mt-5 leading-7 text-slate-300">
            {document.description}
          </p>
        )}

        <div className="mt-8">
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Open document
          </a>
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Your access to this shared document has been recorded.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
        Secure document
      </p>

      <h1 className="mt-4 text-2xl font-semibold">
        This document is private
      </h1>

      <p className="mt-3 leading-7 text-slate-400">
        Enter the email address this document was shared with to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-7">
        <label
          htmlFor="share-email"
          className="text-sm font-medium text-slate-300"
        >
          Email address
        </label>

        <input
          id="share-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="name@company.co.uk"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-slate-500"
        />

        {error && (
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isChecking}
          className="mt-5 w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isChecking ? "Checking..." : "Continue"}
        </button>
      </form>

      {canRequestAccess && (
        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          onClick={() =>
            setError(
              "Access requests are coming next. For now, contact the person who shared this document.",
            )
          }
        >
          Request access
        </button>
      )}

      <p className="mt-6 text-xs leading-5 text-slate-500">
        Access is restricted to the intended recipient and the share may expire
        or be revoked.
      </p>
    </div>
  );
}
