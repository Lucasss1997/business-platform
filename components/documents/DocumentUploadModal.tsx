"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  uploadDocument,
} from "@/lib/documents";

type DocumentUploadModalProps = {
  open: boolean;
  companyId: string;
  opportunityId?: string | null;
  actorName?: string;
  onClose: () => void;
  onUploaded?: (document: DocumentRecord) => void;
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function titleFromFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const name = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;

  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function DocumentUploadModal({
  open,
  companyId,
  opportunityId = null,
  actorName = "System",
  onClose,
  onUploaded,
}: DocumentUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] =
    useState<DocumentType>("other");
  const [status, setStatus] = useState<DocumentStatus>("draft");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const maxFileSizeLabel = useMemo(
    () => formatFileSize(MAX_DOCUMENT_SIZE_BYTES),
    [],
  );

  function resetForm() {
    setFile(null);
    setTitle("");
    setDescription("");
    setDocumentType("other");
    setStatus("draft");
    setError(null);
    setIsUploading(false);
    setIsDragging(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    if (isUploading) {
      return;
    }

    resetForm();
    onClose();
  }

  function selectFile(selectedFile: File | null) {
    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
      setError(`Documents must be no larger than ${maxFileSizeLabel}.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);

    if (!title.trim()) {
      setTitle(titleFromFileName(selectedFile.name));
    }

    if (selectedFile.type.startsWith("image/")) {
      setDocumentType("image");
    } else if (selectedFile.type === "application/pdf") {
      setDocumentType("other");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!companyId) {
      setError("A company is required before uploading a document.");
      return;
    }

    if (!file) {
      setError("Select a document to upload.");
      return;
    }

    if (!title.trim()) {
      setError("Enter a document title.");
      return;
    }

    setIsUploading(true);

    const result = await uploadDocument({
      file,
      companyId,
      opportunityId,
      title: title.trim(),
      description: description.trim() || null,
      documentType,
      status,
      createdBy: actorName,
    });

    if (!result.success) {
      setError(result.error);
      setIsUploading(false);
      return;
    }

    onUploaded?.(result.data);
    resetForm();
    onClose();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isUploading) {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isUploading]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-upload-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="document-upload-title"
              className="text-xl font-semibold text-slate-950"
            >
              Upload document
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add a document to this company&apos;s secure document centre.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close upload modal"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              File
            </label>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                selectFile(event.target.files?.[0] ?? null);
              }}
            />

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={[
                "flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
                isUploading
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer",
              ].join(" ")}
            >
              <span className="text-3xl" aria-hidden="true">
                {file ? "📄" : "⬆️"}
              </span>

              {file ? (
                <>
                  <span className="mt-3 font-medium text-slate-900">
                    {file.name}
                  </span>

                  <span className="mt-1 text-sm text-slate-500">
                    {formatFileSize(file.size)}
                  </span>

                  <span className="mt-3 text-sm font-medium text-blue-600">
                    Choose another file
                  </span>
                </>
              ) : (
                <>
                  <span className="mt-3 font-medium text-slate-900">
                    Drop a file here or click to browse
                  </span>

                  <span className="mt-1 text-sm text-slate-500">
                    PDF, Office, text, CSV or image up to {maxFileSizeLabel}
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="document-title"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Title
              </label>

              <input
                id="document-title"
                type="text"
                value={title}
                disabled={isUploading}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Document title"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="document-type"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Document type
              </label>

              <select
                id="document-type"
                value={documentType}
                disabled={isUploading}
                onChange={(event) =>
                  setDocumentType(event.target.value as DocumentType)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="document-status"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Status
              </label>

              <select
                id="document-status"
                value={status}
                disabled={isUploading}
                onChange={(event) =>
                  setStatus(event.target.value as DocumentStatus)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {DOCUMENT_STATUSES.map((documentStatus) => (
                  <option key={documentStatus} value={documentStatus}>
                    {DOCUMENT_STATUS_LABELS[documentStatus]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="document-description"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Description
                <span className="ml-1 font-normal text-slate-400">
                  Optional
                </span>
              </label>

              <textarea
                id="document-description"
                value={description}
                disabled={isUploading}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Add notes or a brief description..."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isUploading || !file || !title.trim()}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Upload document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}