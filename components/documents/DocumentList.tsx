"use client";

import { useEffect, useMemo, useState } from "react";
import DocumentCard from "@/components/documents/DocumentCard";
import DocumentUploadModal from "@/components/documents/DocumentUploadModal";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  getCompanyDocuments,
} from "@/lib/documents";

type DocumentListProps = {
  companyId: string;
  actorName?: string;
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

type TypeFilter = DocumentType | "all";
type StatusFilter = DocumentStatus | "all";

export default function DocumentList({
  companyId,
  actorName = "System",
}: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments(showRefreshingState = false) {
    if (!companyId) {
      setDocuments([]);
      setError("A company is required to load documents.");
      setIsLoading(false);
      return;
    }

    if (showRefreshingState) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    const result = await getCompanyDocuments(companyId);

    if (!result.success) {
      setDocuments([]);
      setError(result.error);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setDocuments(result.data);
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    void loadDocuments();
  }, [companyId]);

  const filteredDocuments = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesSearch =
        !normalisedSearch ||
        document.title.toLowerCase().includes(normalisedSearch) ||
        document.file_name.toLowerCase().includes(normalisedSearch) ||
        document.description
          ?.toLowerCase()
          .includes(normalisedSearch) ||
        DOCUMENT_TYPE_LABELS[document.document_type]
          .toLowerCase()
          .includes(normalisedSearch);

      const matchesType =
        typeFilter === "all" ||
        document.document_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        document.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documents, search, typeFilter, statusFilter]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
  }

  function handleUploaded(document: DocumentRecord) {
    setDocuments((current) => [
      document,
      ...current.filter((item) => item.id !== document.id),
    ]);
  }

  function handleDeleted(documentId: string) {
    setDocuments((current) =>
      current.filter((document) => document.id !== documentId),
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Documents
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Store quotes, proposals, contracts, surveys and other
              company files.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void loadDocuments(true)}
              disabled={isLoading || isRefreshing}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Upload document
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <div>
            <label htmlFor="document-search" className="sr-only">
              Search documents
            </label>

            <input
              id="document-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, file name or description..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label htmlFor="document-type-filter" className="sr-only">
              Filter by document type
            </label>

            <select
              id="document-type-filter"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as TypeFilter)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="all">All document types</option>

              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="document-status-filter"
              className="sr-only"
            >
              Filter by document status
            </label>

            <select
              id="document-status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="all">All statuses</option>

              {DOCUMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {DOCUMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
          <span>
            {documents.length}{" "}
            {documents.length === 1 ? "document" : "documents"}
          </span>

          {hasActiveFilters && (
            <>
              <span aria-hidden="true">•</span>

              <span>
                {filteredDocuments.length}{" "}
                {filteredDocuments.length === 1
                  ? "result"
                  : "results"}
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5"
        >
          <h3 className="font-semibold text-red-800">
            Documents could not be loaded
          </h3>

          <p className="mt-1 text-sm text-red-700">{error}</p>

          <button
            type="button"
            onClick={() => void loadDocuments()}
            className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      {!error && isLoading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      )}

      {!error &&
        !isLoading &&
        documents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="text-4xl" aria-hidden="true">
              📁
            </div>

            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              No documents yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Upload the first quote, proposal, contract, survey or
              supporting file for this company.
            </p>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Upload first document
            </button>
          </div>
        )}

      {!error &&
        !isLoading &&
        documents.length > 0 &&
        filteredDocuments.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h3 className="text-lg font-semibold text-slate-950">
              No matching documents
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try changing your search or filter selections.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        )}

      {!error &&
        !isLoading &&
        filteredDocuments.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                actorName={actorName}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}

      <DocumentUploadModal
        open={isUploadOpen}
        companyId={companyId}
        actorName={actorName}
        onClose={() => setIsUploadOpen(false)}
        onUploaded={handleUploaded}
      />
    </section>
  );
}