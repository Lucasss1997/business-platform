import { logActivity } from "@/lib/activity";
import { supabase } from "@/lib/supabase";

export const DOCUMENTS_BUCKET = "documents";
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

export const DOCUMENT_TYPES = [
  "quote",
  "proposal",
  "contract",
  "order_form",
  "statement_of_work",
  "purchase_order",
  "invoice",
  "site_survey",
  "technical",
  "image",
  "other",
] as const;

export const DOCUMENT_STATUSES = [
  "draft",
  "final",
  "sent",
  "signed",
  "archived",
] as const;

export const DOCUMENT_SOURCES = ["uploaded", "generated"] as const;

export const SIGNATURE_STATUSES = [
  "not_required",
  "draft",
  "sent",
  "viewed",
  "partially_signed",
  "completed",
  "declined",
  "expired",
  "cancelled",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export type DocumentRecord = {
  id: string;
  company_id: string | null;
  opportunity_id: string | null;
  title: string;
  description: string | null;
  document_type: DocumentType;
  source: DocumentSource;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  version: number;
  status: DocumentStatus;
  template_id: string | null;
  generated_from: Record<string, unknown>;
  signature_status: SignatureStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadDocumentInput = {
  file: File;
  companyId: string;
  opportunityId?: string | null;
  title?: string;
  description?: string | null;
  documentType?: DocumentType;
  status?: DocumentStatus;
  createdBy?: string;
};

export type UpdateDocumentInput = {
  title?: string;
  description?: string | null;
  documentType?: DocumentType;
  status?: DocumentStatus;
  signatureStatus?: SignatureStatus;
};

export type DocumentServiceResult<T> =
  | {
      success: true;
      data: T;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: string;
    };

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function failure<T>(error: unknown): DocumentServiceResult<T> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected document error occurred.";

  return {
    success: false,
    data: null,
    error: message,
  };
}

function success<T>(data: T): DocumentServiceResult<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

function sanitiseFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const hasExtension = lastDot > 0;

  const baseName = hasExtension
    ? fileName.slice(0, lastDot)
    : fileName;

  const extension = hasExtension
    ? fileName.slice(lastDot).toLowerCase()
    : "";

  const safeBaseName = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeBaseName || "document"}${extension}`;
}

function fileNameWithoutExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot <= 0) {
    return fileName;
  }

  return fileName.slice(0, lastDot);
}

function validateFile(file: File) {
  if (!file) {
    throw new Error("Please select a document to upload.");
  }

  if (file.size <= 0) {
    throw new Error("The selected document is empty.");
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("Documents must be no larger than 20 MB.");
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      "This file type is not supported. Upload a PDF, Office document, text file, CSV or image.",
    );
  }
}

function buildStoragePath({
  companyId,
  opportunityId,
  documentId,
  fileName,
}: {
  companyId: string;
  opportunityId?: string | null;
  documentId: string;
  fileName: string;
}) {
  const parentFolder = opportunityId || "general";

  return [
    companyId,
    parentFolder,
    documentId,
    sanitiseFileName(fileName),
  ].join("/");
}

export async function uploadDocument({
  file,
  companyId,
  opportunityId = null,
  title,
  description = null,
  documentType = "other",
  status = "draft",
  createdBy = "System",
}: UploadDocumentInput): Promise<
  DocumentServiceResult<DocumentRecord>
> {
  try {
    if (!companyId) {
      throw new Error("A company is required before uploading a document.");
    }

    validateFile(file);

    const documentId = crypto.randomUUID();

    const filePath = buildStoragePath({
      companyId,
      opportunityId,
      documentId,
      fileName: file.name,
    });

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const documentPayload = {
      id: documentId,
      company_id: companyId,
      opportunity_id: opportunityId,
      title: title?.trim() || fileNameWithoutExtension(file.name),
      description: description?.trim() || null,
      document_type: documentType,
      source: "uploaded" as const,
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
      version: 1,
      status,
      generated_from: {},
      signature_status: "not_required" as const,
      created_by: createdBy,
    };

    const { data, error: databaseError } = await supabase
      .from("documents")
      .insert(documentPayload)
      .select("*")
      .single();

    if (databaseError) {
      await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([filePath]);

      throw new Error(
        `The file uploaded, but its document record could not be created: ${databaseError.message}`,
      );
    }

    const document = data as DocumentRecord;

    await logActivity({
      companyId,
      entityType: "document",
      entityId: document.id,
      action: "document_uploaded",
      description: `Uploaded document “${document.title}”.`,
      actorName: createdBy,
      metadata: {
        file_name: document.file_name,
        document_type: document.document_type,
        file_size: document.file_size,
        opportunity_id: opportunityId,
      },
    });

    return success(document);
  } catch (error) {
    return failure(error);
  }
}

export async function getCompanyDocuments(
  companyId: string,
): Promise<DocumentServiceResult<DocumentRecord[]>> {
  try {
    if (!companyId) {
      throw new Error("A company ID is required.");
    }

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return success((data || []) as DocumentRecord[]);
  } catch (error) {
    return failure(error);
  }
}

export async function getOpportunityDocuments(
  opportunityId: string,
): Promise<DocumentServiceResult<DocumentRecord[]>> {
  try {
    if (!opportunityId) {
      throw new Error("An opportunity ID is required.");
    }

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return success((data || []) as DocumentRecord[]);
  } catch (error) {
    return failure(error);
  }
}

export async function getDocument(
  documentId: string,
): Promise<DocumentServiceResult<DocumentRecord>> {
  try {
    if (!documentId) {
      throw new Error("A document ID is required.");
    }

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return success(data as DocumentRecord);
  } catch (error) {
    return failure(error);
  }
}

export async function createDocumentDownloadUrl(
  document: Pick<DocumentRecord, "file_path">,
  expiresInSeconds = 300,
): Promise<DocumentServiceResult<string>> {
  try {
    if (!document.file_path) {
      throw new Error("This document does not have a valid storage path.");
    }

    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.file_path, expiresInSeconds);

    if (error) {
      throw new Error(error.message);
    }

    if (!data.signedUrl) {
      throw new Error("Supabase did not return a document download URL.");
    }

    return success(data.signedUrl);
  } catch (error) {
    return failure(error);
  }
}

export async function downloadDocument(
  document: Pick<DocumentRecord, "file_path" | "file_name">,
): Promise<DocumentServiceResult<true>> {
  try {
    const urlResult = await createDocumentDownloadUrl(document);

    if (!urlResult.success) {
      return urlResult;
    }

    const anchor = window.document.createElement("a");

    anchor.href = urlResult.data;
    anchor.download = document.file_name;
    anchor.rel = "noopener noreferrer";

    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    return success(true);
  } catch (error) {
    return failure(error);
  }
}

export async function updateDocument(
  documentId: string,
  updates: UpdateDocumentInput,
  actorName = "System",
): Promise<DocumentServiceResult<DocumentRecord>> {
  try {
    if (!documentId) {
      throw new Error("A document ID is required.");
    }

    const payload = {
      ...(updates.title !== undefined && {
        title: updates.title.trim(),
      }),
      ...(updates.description !== undefined && {
        description: updates.description?.trim() || null,
      }),
      ...(updates.documentType !== undefined && {
        document_type: updates.documentType,
      }),
      ...(updates.status !== undefined && {
        status: updates.status,
      }),
      ...(updates.signatureStatus !== undefined && {
        signature_status: updates.signatureStatus,
      }),
    };

    if ("title" in payload && !payload.title) {
      throw new Error("The document title cannot be empty.");
    }

    const { data, error } = await supabase
      .from("documents")
      .update(payload)
      .eq("id", documentId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const document = data as DocumentRecord;

    await logActivity({
      companyId: document.company_id,
      entityType: "document",
      entityId: document.id,
      action: "updated",
      description: `Updated document “${document.title}”.`,
      actorName,
      metadata: {
        document_type: document.document_type,
        status: document.status,
        signature_status: document.signature_status,
      },
    });

    return success(document);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteDocument(
  document: DocumentRecord,
  actorName = "System",
): Promise<DocumentServiceResult<true>> {
  try {
    if (!document.id) {
      throw new Error("A document ID is required.");
    }

    if (!document.file_path) {
      throw new Error("The document does not have a valid storage path.");
    }

    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([document.file_path]);

    if (storageError) {
      throw new Error(
        `The stored file could not be deleted: ${storageError.message}`,
      );
    }

    const { error: databaseError } = await supabase
      .from("documents")
      .delete()
      .eq("id", document.id);

    if (databaseError) {
      throw new Error(
        `The stored file was removed, but the document record could not be deleted: ${databaseError.message}`,
      );
    }

    await logActivity({
      companyId: document.company_id,
      entityType: "document",
      entityId: document.id,
      action: "deleted",
      description: `Deleted document “${document.title}”.`,
      actorName,
      metadata: {
        file_name: document.file_name,
        document_type: document.document_type,
        opportunity_id: document.opportunity_id,
      },
    });

    return success(true);
  } catch (error) {
    return failure(error);
  }
}