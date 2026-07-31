import type {
  ActivityMetadata,
} from "@/platform/activity";

export interface PlatformEvent {
  entityType: string;
  action: string;

  entityId?: string;
  companyId?: string;

  actorName?: string;

  description?: string;

  metadata?: ActivityMetadata;
}