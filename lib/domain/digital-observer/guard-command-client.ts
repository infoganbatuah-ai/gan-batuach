import "server-only";

import type { GuardAction } from "./guard-engine";

/**
 * Server-side SDK used by the Digital Guard worker. The worker never talks to
 * a camera directly. It is the Guard's recommendation boundary: physical
 * execution remains behind the authenticated dashboard confirmation flow.
 */
export async function requestDigitalGuardCameraAction(input: {
  cameraSourceId: string;
  action: GuardAction;
  payload: Record<string, unknown>;
  allowedActions: GuardAction[];
  baseUrl?: string;
}) {
  const allowed = input.allowedActions.includes(input.action);
  return { state: "pending_human_confirmation" as const, allowed, action: input.action, camera_source_id: input.cameraSourceId, message: allowed ? "Digital Guard recommends this action; a human must confirm it before any physical command." : "Digital Guard cannot recommend this action because the live capability map does not allow it." };
}
