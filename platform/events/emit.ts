import { subscribers } from "./subscribers";
import type { PlatformEvent } from "./types";

export async function emitEvent(
  event: PlatformEvent,
) {
  for (const subscriber of subscribers) {
    await subscriber(event);
  }
}