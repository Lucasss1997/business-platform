"use client";

import { useState } from "react";
import {
  deleteDocument,
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl"
          aria-hidden="true"
        >
          {getDocumentIcon(document)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                className="truncate text-base font-semibold text-slate-950"
                title={document.title}
              >
                {document.title}
              </h3>

              <p
                className="mt-1 truncate text-sm text-slate-500"
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
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
              {document.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
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

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isDeleting}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDownloading ? "Preparing..." : "Download"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDownloading || isDeleting}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}