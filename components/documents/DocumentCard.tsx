"use client";

import { useState } from "react";
import {
  deleteDocument,
  DOCUMENTS_BUCKET,
  DocumentRecord,
  downloadDocument,
  DocumentStatus,
  DocumentType,
} from "@/lib/documents";

type DocumentCardProps = {
  document: DocumentRecord;
  actorName?: string;
  onDeleted?: (documentId: string) => void;
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  quote: "Quote",
  proposal: "Proposal",
  contract: "Contract",
  order_form: "Order form",
  statement_of_work: "Statement of work",
  purchase_order: "Purchase order",
  invoice: "Invoice",
  site_survey: "Site survey",
  technical: "Technical document",
  image: "Image",
  other: "Other",
};

const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  final: "Final",
  sent: "Sent",
  signed: "Signed",
  archived: "Archived",
};

const STATUS_CLASSES: Record<DocumentStatus, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  final: "border-blue-200 bg-blue-50 text-blue-700",
  sent: "border-amber-200 bg-amber-50 text-amber-700",
  signed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  archived: "border-slate-200 bg-slate-50 text-slate-500",
};

function formatFileSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDocumentIcon(document: DocumentRecord) {
  if (document.mime_type?.startsWith("image/")) {
    return "🖼️";
  }

  if (document.mime_type === "application/pdf") {
    return "📕";
  }

  if (
    document.mime_type?.includes("word") ||
    document.mime_type === "application/msword"
  ) {
    return "📘";
  }

  if (
    document.mime_type?.includes("spreadsheet") ||
    document.mime_type?.includes("excel")
  ) {
    return "📗";
  }

  if (
    document.mime_type?.includes("presentation") ||
    document.mime_type?.includes("powerpoint")
  ) {
    return "📙";
  }

  return "📄";
}

export default function DocumentCard({
  document,
  actorName = "System",
  onDeleted,
}: DocumentCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareAccessCount, setShareAccessCount] = useState(0);
  const [shareLastAccessedAt, setShareLastAccessedAt] = useState<string | null>(null);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleView() {
    setError(null);
    setIsViewing(true);

    try {
      const { supabase } = await import("@/lib/supabase");

      const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(document.file_path, 300);

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.signedUrl) {
        throw new Error("The document could not be opened.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The document could not be opened.",
      );
    } finally {
      setIsViewing(false);
    }
  }

  function handleShare() {
    setError(null);

    if (isSharePanelOpen) {
      setIsSharePanelOpen(false);
      return;
    }

    setIsSharePanelOpen(true);
  }

  async function handleCreateShare() {
    setError(null);

    const email = recipientEmail.trim().toLowerCase();

    if (!email) {
      setError("Enter the recipient email address.");
      return;
    }

    setIsSharing(true);

    try {
      const response = await fetch("/api/document-shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: document.id,
          recipientEmail: email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The secure share could not be created."
        );
      }

      setRecipientEmail(result.recipientEmail || email);
      setShareUrl(result.url);
      setShareId(result.id);
      setShareExpiresAt(result.expiresAt);
      setShareAccessCount(result.accessCount ?? 0);
      setShareLastAccessedAt(result.lastAccessedAt ?? null);

      const emailResponse = await fetch("/api/document-shares/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareId: result.id,
        }),
      });

      const emailResult = await emailResponse.json();

      if (!emailResponse.ok) {
        throw new Error(
          emailResult.error ||
            "The secure share was created, but the email could not be sent."
        );
      }

      setShareMessage(`Secure email sent to ${emailResult.recipientEmail}.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The secure share could not be created and sent."
      );
    } finally {
      setIsSharing(false);
    }
  }

  async function handleRevokeShare() {
    if (!shareId) {
      return;
    }

    const confirmed = window.confirm(
      "Revoke this share link? Anyone using the link will immediately lose access.",
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsSharing(true);

    try {
      const response = await fetch("/api/document-shares", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The share link could not be revoked.");
      }

      setShareUrl(null);
      setShareId(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The share link could not be revoked.",
      );
    } finally {
      setIsSharing(false);
    }
  }
  async function handleCopyShareLink() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      setError("The share link could not be copied.");
    }
  }

  async function handleEmailShare() {
    if (!shareId) {
      return;
    }

    setError(null);
    setIsSharing(true);

    try {
      const response = await fetch("/api/document-shares/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The secure-share email could not be sent."
        );
      }

      window.alert(`Secure email sent to ${result.recipientEmail}.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The secure-share email could not be sent."
      );
    } finally {
      setIsSharing(false);
    }
  }

  function handleTeamsShare() {
    if (!shareUrl) {
      return;
    }

    const url =
      "https://teams.microsoft.com/share" +
      "?href=" +
      encodeURIComponent(shareUrl) +
      "&msgText=" +
      encodeURIComponent(document.title);

    window.open(url, "_blank", "noopener,noreferrer");
  }
  async function handleDownload() {
    setError(null);
    setIsDownloading(true);

    const result = await downloadDocument(document);

    if (!result.success) {
      setError(result.error);
    }

    setIsDownloading(false);
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete “${document.title}”? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    const result = await deleteDocument(document, actorName);

    if (!result.success) {
      setError(result.error);
      setIsDeleting(false);
      return;
    }

    onDeleted?.(document.id);
  }

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-2xl"
          aria-hidden="true"
        >
          {getDocumentIcon(document)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                className="truncate text-base font-semibold text-[var(--text-primary)]"
                title={document.title}
              >
                {document.title}
              </h3>

              <p
                className="mt-1 truncate text-sm text-[var(--text-secondary)]"
                title={document.file_name}
              >
                {document.file_name}
              </p>
            </div>

            <span
              className={[
                "inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                STATUS_CLASSES[document.status],
              ].join(" ")}
            >
              {DOCUMENT_STATUS_LABELS[document.status]}
            </span>
          </div>

          {document.description && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
              {document.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]">
            <span>{DOCUMENT_TYPE_LABELS[document.document_type]}</span>
            <span>Version {document.version}</span>
            <span>{formatFileSize(document.file_size)}</span>
            <span>{formatDate(document.created_at)}</span>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleView}
                disabled={isViewing || isDownloading || isSharing || isDeleting}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isViewing ? "Opening..." : "View"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isViewing || isDownloading || isSharing || isDeleting}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDownloading ? "Preparing..." : "Download"}
              </button>

              <button
                type="button"
                onClick={handleShare}
                disabled={isViewing || isDownloading || isSharing || isDeleting}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSharing
                  ? "Creating..."
                  : isSharePanelOpen
                    ? "Close share"
                    : "Share"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isViewing || isDownloading || isSharing || isDeleting}
                className="rounded-lg border border-red-300 bg-transparent px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>

            {isSharePanelOpen && (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                {shareMessage && (
                  <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    &#10003; {shareMessage}
                  </div>
                )}
                {!shareUrl ? (
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Share securely
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      The recipient will need to enter this email address before
                      they can access the document.
                    </p>

                    <label
                      htmlFor={`share-email-${document.id}`}
                      className="mt-4 block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Recipient email
                    </label>

                    <input
                      id={`share-email-${document.id}`}
                      type="email"
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      placeholder="name@company.co.uk"
                      autoComplete="off"
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]"
                    />

                    <button
                      type="button"
                      onClick={handleCreateShare}
                      disabled={isSharing || !recipientEmail.trim()}
                      className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSharing ? "Creating & sending..." : "Create & send secure email"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Secure share active
                        </p>

                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          Shared with {recipientEmail}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    </div>

                    {shareExpiresAt && (
                      <p className="mt-3 text-xs text-[var(--text-secondary)]">
                        Expires {formatDate(shareExpiresAt)}
                      </p>
                    )}

                    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {shareAccessCount > 0
                          ? `Opened ${shareAccessCount} ${
                              shareAccessCount === 1 ? "time" : "times"
                            }`
                          : "Not opened yet"}
                      </p>

                      {shareLastAccessedAt && (
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          Last opened {formatDate(shareLastAccessedAt)}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"
                      >
                        Copy link
                      </button>

                      <button
                        type="button"
                        onClick={handleEmailShare}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"
                      >
                        Resend email
                      </button>

                      <button
                        type="button"
                        onClick={handleTeamsShare}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"
                      >
                        Teams
                      </button>

                      <button
                        type="button"
                        onClick={handleRevokeShare}
                        disabled={isSharing}
                        className="rounded-lg border border-red-300 bg-transparent px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSharing ? "Revoking..." : "Revoke"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
















