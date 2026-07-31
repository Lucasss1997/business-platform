export type ActivityEntityType =
  | "company"
  | "contact"
  | "opportunity"
  | "proposal"
  | "catalogue_item"
  | "task"
  | "document"
  | "invoice"
  | "project"
  | "user"
  | "platform";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "stage_changed"
  | "status_changed"
  | "assigned"
  | "completed"
  | "reopened"
  | "note_added"
  | "document_uploaded"
  | "proposal_sent"
  | "proposal_accepted"
  | "proposal_rejected"
  | "approved"
  | "rejected";

export type ActivityMetadataValue =
  | string
  | number
  | boolean
  | null;

export type ActivityMetadata = Record<
  string,
  ActivityMetadataValue
>;

export interface LogActivityInput {
  companyId?: string | null;
  entityType: ActivityEntityType;
  entityId?: string | null;
  action: ActivityAction;
  description: string;
  actorName?: string;
  metadata?: ActivityMetadata;
}

export interface ActivityLogRecord {
  id: string;
  company_id: string | null;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  action: ActivityAction;
  description: string;
  actor_name: string | null;
  metadata: ActivityMetadata | null;
  created_at: string;
}