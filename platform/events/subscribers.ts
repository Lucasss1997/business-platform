import { logActivity } from "@/platform/activity";
import type { PlatformEvent } from "./types";

export async function activitySubscriber(
  event: PlatformEvent,
) {
  await logActivity({
    companyId: event.companyId,
    entityType: event.entityType as any,
    entityId: event.entityId,
    action: event.action as any,
    description: event.description ?? "",
    actorName: event.actorName,
    metadata: event.metadata,
  });
}

export const subscribers = [
  activitySubscriber,
];