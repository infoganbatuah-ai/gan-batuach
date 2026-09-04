import "server-only";

import {
  recommendGuardCameraAction,
  type AutonomousGuardAction,
  type GuardAutomationEvent,
  type GuardAutomationPolicy
} from "./guard-engine";
import {
  refreshDigitalGuardCapabilityForEvent,
  requestDigitalGuardCameraAction,
  type GuardCommandDatabase
} from "./guard-command-client";
import type { CameraQueueResult, QueueSource } from "./camera-queue-contract";

const POLICY_SELECT = "id,observer_site_id,camera_source_id,enabled,allowed_actions,lighting_event_types,siren_event_types,minimum_confidence,siren_minimum_confidence,siren_duration_ms";

function policyFromRow(row: Record<string, unknown>): GuardAutomationPolicy {
  if (row.siren_duration_ms !== 1000) throw new Error("DIGITAL_GUARD_POLICY_INVALID");
  return {
    id: String(row.id),
    siteId: String(row.observer_site_id),
    cameraId: String(row.camera_source_id),
    enabled: row.enabled === true,
    allowedActions: (Array.isArray(row.allowed_actions) ? row.allowed_actions : [])
      .filter((action): action is AutonomousGuardAction => action === "lighting" || action === "siren"),
    lightingEventTypes: Array.isArray(row.lighting_event_types) ? row.lighting_event_types.map(String) : [],
    sirenEventTypes: Array.isArray(row.siren_event_types) ? row.siren_event_types.map(String) : [],
    minimumConfidence: Number(row.minimum_confidence),
    sirenMinimumConfidence: Number(row.siren_minimum_confidence),
    sirenDurationMs: 1000
  };
}

async function latestCapabilityResult(database: GuardCommandDatabase, siteId: string, cameraId: string) {
  const found = await database.from("digital_observer_camera_action_requests")
    .select("result,completed_at").eq("observer_site_id", siteId).eq("camera_source_id", cameraId)
    .eq("task_kind", "capability_snapshot").eq("action_status", "completed")
    .order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (found.error) throw new Error("DIGITAL_GUARD_CAPABILITY_READ_FAILED");
  const persisted = found.data?.result;
  if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) return null;
  const wire = { ...(persisted as Record<string, unknown>) };
  if (wire.reported_by_gateway !== true) return null;
  delete wire.reported_by_gateway;
  return wire as CameraQueueResult;
}

export async function dispatchDigitalGuardActionsForValidatedEvent(input: {
  database: GuardCommandDatabase;
  siteId: string;
  source: QueueSource;
  gatewayId: string;
  signalId: string;
  eventType: string;
  evidenceKind: string;
  severity: "info" | "medium" | "critical";
  confidence: number;
  occurredAt: string;
  validated: boolean;
  now?: number;
}) {
  const policyResult = await input.database.from("digital_observer_camera_automation_policies")
    .select(POLICY_SELECT).eq("observer_site_id", input.siteId).eq("camera_source_id", input.source.id)
    .eq("enabled", true).maybeSingle();
  if (policyResult.error) throw new Error("DIGITAL_GUARD_POLICY_READ_FAILED");
  if (!policyResult.data) return { state: "disabled" as const, actions: [] };

  const policy = policyFromRow(policyResult.data);
  const event: GuardAutomationEvent = {
    id: input.signalId,
    siteId: input.siteId,
    cameraId: input.source.id,
    eventType: input.eventType,
    evidenceKind: input.evidenceKind,
    severity: input.severity,
    confidence: input.confidence,
    occurredAt: input.occurredAt,
    validated: input.validated
  };
  let capabilityResult = await latestCapabilityResult(input.database, input.siteId, input.source.id);

  const candidates = (["lighting", "siren"] as const).filter((action) => policy.allowedActions.includes(action));
  const actions = [];
  for (const action of candidates) {
    let capabilityDecision = recommendGuardCameraAction({
      action,
      source: input.source,
      claims: { gateway_id: input.gatewayId, observer_site_id: input.siteId },
      capabilityResult,
      now: input.now
    });
    if ("reason" in capabilityDecision
      && (capabilityDecision.reason === "stale_evidence" || capabilityDecision.reason === "capability_unavailable")) {
      const refresh = await refreshDigitalGuardCapabilityForEvent({
        database: input.database,
        signalId: input.signalId,
        action,
        gatewayId: input.gatewayId
      });
      if (refresh.status !== "fresh") {
        actions.push({ state: "blocked" as const, dispatch_allowed: false as const,
          requires_human_confirmation: false as const, action, reason: refresh.reason ?? "capability_refresh_required" });
        continue;
      }
      capabilityResult = await latestCapabilityResult(input.database, input.siteId, input.source.id);
      capabilityDecision = recommendGuardCameraAction({
        action,
        source: input.source,
        claims: { gateway_id: input.gatewayId, observer_site_id: input.siteId },
        capabilityResult,
        now: input.now
      });
    }
    const payload = action === "siren" ? { enabled: true, duration_ms: 1000 } : { enabled: true, duration_ms: 20_000 };
    actions.push(await requestDigitalGuardCameraAction({
      database: input.database,
      policy,
      event,
      action,
      payload,
      capabilityDecision,
      now: input.now
    }));
  }
  return {
    state: actions.some((action) => "queued" in action && action.queued) ? "queued" as const : "blocked" as const,
    actions
  };
}
