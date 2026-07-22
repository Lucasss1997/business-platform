import { supabase } from "@/lib/supabase";

export type ActivityEntityType =
  | "company"
  | "contact"
  | "opportunity"
  | "proposal"
  | "catalogue_item"
  | "task"
  | "document";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "stage_changed"
  | "completed"
  | "reopened"
  | "note_added"
  | "document_uploaded"
  | "proposal_sent"
  | "proposal_accepted"
  | "proposal_rejected";

export type ActivityMetadata = Record<
  string,
  string | number | boolean | null
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

export async function logActivity({
  companyId = null,
  entityType,
  entityId = null,
  action,
  description,
  actorName = "System",
  metadata = {},
}: LogActivityInput) {
  const { error } = await supabase.from("activity_log").insert({
    company_id: companyId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    actor_name: actorName,
    metadata,
  });

  if (error) {
    console.error("Activity logging failed:", error.message);

    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    error: null,
  };
}