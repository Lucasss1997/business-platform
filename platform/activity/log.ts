import { supabase } from "@/lib/supabase";

import type {
  ActivityLogRecord,
  LogActivityInput,
} from "@/platform/activity/types";

export async function logActivity(
  input: LogActivityInput,
): Promise<ActivityLogRecord> {
  const {
    companyId = null,
    entityType,
    entityId = null,
    action,
    description,
    actorName = "System",
    metadata = {},
  } = input;

  const {
    data,
    error,
  } = await supabase
    .from("activity_log")
    .insert({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      description,
      actor_name: actorName,
      metadata,
    })
    .select(
      `
        id,
        company_id,
        entity_type,
        entity_id,
        action,
        description,
        actor_name,
        metadata,
        created_at
      `,
    )
    .single();

  if (error) {
    throw new Error(
      `Activity could not be recorded: ${error.message}`,
    );
  }

  return data as ActivityLogRecord;
}