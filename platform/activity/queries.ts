import { supabase } from "@/lib/supabase";

import type {
  ActivityLogRecord,
} from "@/platform/activity/types";

const activitySelect = `
  id,
  company_id,
  entity_type,
  entity_id,
  action,
  description,
  actor_name,
  metadata,
  created_at
`;

export async function getCompanyActivity(
  companyId: string,
  limit = 100,
): Promise<ActivityLogRecord[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select(activitySelect)
    .eq("company_id", companyId)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `Company activity could not be loaded: ${error.message}`,
    );
  }

  return (data ?? []) as ActivityLogRecord[];
}

export async function getRecentActivity(
  limit = 50,
): Promise<ActivityLogRecord[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select(activitySelect)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `Recent activity could not be loaded: ${error.message}`,
    );
  }

  return (data ?? []) as ActivityLogRecord[];
}

export async function getUserActivity(
  actorName: string,
  limit = 100,
): Promise<ActivityLogRecord[]> {
  const trimmedActorName = actorName.trim();

  if (!trimmedActorName) {
    return [];
  }

  const { data, error } = await supabase
    .from("activity_log")
    .select(activitySelect)
    .eq("actor_name", trimmedActorName)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `User activity could not be loaded: ${error.message}`,
    );
  }

  return (data ?? []) as ActivityLogRecord[];
}