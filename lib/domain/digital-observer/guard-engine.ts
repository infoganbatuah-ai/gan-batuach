/**
 * חוזי הליבה של התצפיתן הדיגיטלי.
 *
 * הקובץ intentionally אינו תלוי ב-Supabase או בספק AI. כך אפשר להחליף
 * Gateway/מודל בלי לשנות את מסכי המוצר, ובמקביל לשמור על מדיניות בטוחה:
 * אין פעולה פיזית בלי יכולת מדווחת ואישור אנושי.
 */

import { GUARD_EVENT_TYPES, type GuardEventType } from "./guard-event-types";
import type { GuardDiagnosticAdapter, GuardDiagnosticRequest, GuardDiagnosticScope } from "./guard-diagnostics-types";
import {
  CAPABILITY_EVIDENCE_MAX_AGE_MS,
  LIVE_EVIDENCE_MAX_AGE_MS,
  allowedPhysicalControls,
  cameraQueueResultSchema,
  physicalCameraActions,
  type QueueSource
} from "./camera-queue-contract";
export { GUARD_EVENT_TYPES, type GuardEventType } from "./guard-event-types";
export type CameraCapabilityKey = "ptz" | "twoWayAudio" | "siren" | "lighting";

export type CameraCapabilityDetail = {
  supported: boolean;
  apiEndpoint?: string;
  states?: string[];
  axes?: string[];
  requiresConfirmation?: boolean;
};

export type CameraCapabilityManifest = {
  cameraId: string;
  cameraZoneName: string;
  discoveredAt: string;
  source: "gateway" | "metadata" | "simulated" | "unknown";
  capabilities: Record<CameraCapabilityKey, boolean>;
  details?: Partial<Record<CameraCapabilityKey, CameraCapabilityDetail>>;
  raw?: Record<string, unknown>;
};

export type CameraCapabilityProbe = {
  manifest: CameraCapabilityManifest;
  evidenceId: string;
  verifiedAt: string;
  gatewayProvider: string;
  gatewayHttpStatus?: number;
};

export interface CameraCommandAdapter {
  execute(command: CameraCommand): Promise<CameraCommandResult>;
}

export type CameraCommand = {
  cameraId: string;
  action: GuardAction;
  payload: Record<string, unknown>;
  requestId: string;
  expiresAt: string;
};

export type CameraCommandResult = {
  acknowledged: true;
  commandId: string;
  state: "acknowledged" | "executed";
  gatewayHttpStatus?: number;
};

export type GuardEvent = {
  id: string;
  type: GuardEventType;
  timestamp: string;
  cameraId: string;
  cameraZoneName: string;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  confidence?: number;
  snapshotUrl?: string | null;
  clipUrl?: string | null;
  requiresHumanReview: boolean;
  metadata?: Record<string, unknown>;
};

export type GuardAction = "ptz" | "talk" | "siren" | "lighting";

export type GuardRecommendationInput = {
  action: GuardAction;
  source: QueueSource;
  claims: { gateway_id: string; observer_site_id: string };
  capabilityResult: unknown;
  now?: number;
};

type GuardBlockReason =
  | "unsupported_action"
  | "source_offline"
  | "binding_mismatch"
  | "capability_unavailable"
  | "stale_evidence";

function blockedRecommendation(input: GuardRecommendationInput, reason: GuardBlockReason) {
  return {
    state: "blocked" as const,
    allowed: false as const,
    dispatch_allowed: false as const,
    executed: false as const,
    camera_source_id: input.source.id,
    site_id: input.source.observer_site_id,
    action: input.action,
    reason
  };
}

function queueSourceOnline(source: QueueSource) {
  return ["connected", "online", "active", "ready"].includes(String(source.status ?? "").toLowerCase())
    && ["healthy", "online", "connected", "ok"].includes(String(source.health_status ?? "").toLowerCase());
}

export function recommendGuardCameraAction(input: GuardRecommendationInput) {
  const now = input.now ?? Date.now();
  if (!physicalCameraActions.includes(input.action as typeof physicalCameraActions[number])) {
    return blockedRecommendation(input, "unsupported_action");
  }
  if (!queueSourceOnline(input.source)) return blockedRecommendation(input, "source_offline");

  const parsed = cameraQueueResultSchema.safeParse(input.capabilityResult);
  if (!parsed.success || parsed.data.outcome !== "capability_snapshot") {
    return blockedRecommendation(input, "capability_unavailable");
  }
  const snapshot = parsed.data.outcome_payload;
  if (input.source.observer_site_id !== input.claims.observer_site_id
    || input.source.metadata?.gateway_id !== input.claims.gateway_id
    || snapshot.site_id !== input.source.observer_site_id
    || snapshot.camera_id !== input.source.id
    || snapshot.gateway_id !== input.claims.gateway_id
    || snapshot.stream_id !== input.source.metadata?.gateway_stream_id
    || snapshot.channel !== input.source.metadata?.dvr_channel) {
    return blockedRecommendation(input, "binding_mismatch");
  }

  const capabilityAt = Date.parse(snapshot.verified_at ?? "");
  const liveAt = Date.parse(snapshot.live?.verified_at ?? "");
  if (!Number.isFinite(capabilityAt) || !Number.isFinite(liveAt)
    || capabilityAt > now + 5_000 || liveAt > now + 5_000
    || now - capabilityAt > CAPABILITY_EVIDENCE_MAX_AGE_MS
    || now - liveAt > LIVE_EVIDENCE_MAX_AGE_MS) {
    return blockedRecommendation(input, "stale_evidence");
  }

  const allowed = allowedPhysicalControls(parsed.data, now);
  if (!allowed.includes(input.action as typeof physicalCameraActions[number])) {
    return blockedRecommendation(input, "unsupported_action");
  }
  return {
    state: "pending_human_confirmation" as const,
    allowed: true as const,
    dispatch_allowed: false as const,
    executed: false as const,
    camera_source_id: input.source.id,
    site_id: input.source.observer_site_id,
    gateway_id: input.claims.gateway_id,
    stream_id: snapshot.stream_id,
    channel: snapshot.channel,
    source_generation: snapshot.source_generation,
    binding_generation: snapshot.binding_generation,
    evidence_id: snapshot.evidence_id,
    action: input.action
  };
}

export type GuardActionRecommendation = {
  cameraId: string;
  trigger: "LINE_CROSSING";
  action: GuardAction;
  allowed: boolean;
  allowedActions: GuardAction[];
  requiresHumanConfirmation: true;
  reason: "capability_verified" | "capability_unavailable" | "gateway_evidence_required";
};

export const autonomousGuardActions = ["lighting", "siren"] as const;
export type AutonomousGuardAction = typeof autonomousGuardActions[number];

export type GuardAutomationPolicy = {
  id: string;
  siteId: string;
  cameraId: string;
  enabled: boolean;
  allowedActions: AutonomousGuardAction[];
  lightingEventTypes: string[];
  sirenEventTypes: string[];
  minimumConfidence: number;
  sirenMinimumConfidence: number;
  sirenDurationMs: 1000;
};

export type GuardAutomationEvent = {
  id: string;
  siteId: string;
  cameraId: string;
  eventType: string;
  evidenceKind: string;
  severity: "info" | "medium" | "critical";
  confidence: number;
  occurredAt: string;
  validated: boolean;
};

type AutonomousGuardBlockReason =
  | "policy_disabled"
  | "policy_scope_mismatch"
  | "action_not_allowed"
  | "event_not_allowed"
  | "event_not_verified"
  | "event_stale"
  | "confidence_too_low"
  | "siren_requires_critical_line_crossing"
  | "live_capability_unavailable";

/**
 * Pure, fail-closed authorization gate for Digital Guard automation. This does
 * not enqueue or execute anything; the database RPC independently repeats the
 * policy, evidence, cooldown and binding checks before it can create a task.
 */
export function authorizeAutonomousGuardAction(input: {
  policy: GuardAutomationPolicy;
  event: GuardAutomationEvent;
  action: AutonomousGuardAction;
  capabilityDecision: ReturnType<typeof recommendGuardCameraAction>;
  now?: number;
}) {
  const blocked = (reason: AutonomousGuardBlockReason) => ({
    state: "blocked" as const,
    dispatch_allowed: false as const,
    requires_human_confirmation: false as const,
    action: input.action,
    reason
  });
  const { policy, event, action, capabilityDecision } = input;
  const now = input.now ?? Date.now();
  if (!policy.enabled) return blocked("policy_disabled");
  if (policy.siteId !== event.siteId || policy.cameraId !== event.cameraId
    || capabilityDecision.site_id !== event.siteId || capabilityDecision.camera_source_id !== event.cameraId) {
    return blocked("policy_scope_mismatch");
  }
  if (!policy.allowedActions.includes(action)) return blocked("action_not_allowed");
  const allowedEvents = action === "siren" ? policy.sirenEventTypes : policy.lightingEventTypes;
  if (!allowedEvents.includes(event.eventType)) return blocked("event_not_allowed");
  if (!event.validated) return blocked("event_not_verified");
  const age = now - Date.parse(event.occurredAt);
  if (!Number.isFinite(age) || age < -5_000 || age > 20_000) return blocked("event_stale");
  const threshold = action === "siren" ? policy.sirenMinimumConfidence : policy.minimumConfidence;
  if (!Number.isFinite(event.confidence) || event.confidence < threshold || event.confidence > 1) {
    return blocked("confidence_too_low");
  }
  if (action === "siren" && (event.severity !== "critical" || event.evidenceKind !== "line_crossing"
    || policy.sirenDurationMs !== 1000)) return blocked("siren_requires_critical_line_crossing");
  if (!capabilityDecision.allowed || capabilityDecision.action !== action
    || capabilityDecision.state !== "pending_human_confirmation") return blocked("live_capability_unavailable");
  return {
    state: "authorized_by_persistent_policy" as const,
    dispatch_allowed: true as const,
    requires_human_confirmation: false as const,
    authorization_kind: "digital_guard_policy" as const,
    policy_id: policy.id,
    event_id: event.id,
    action,
    camera_source_id: event.cameraId,
    site_id: event.siteId,
    gateway_id: capabilityDecision.gateway_id,
    stream_id: capabilityDecision.stream_id,
    channel: capabilityDecision.channel,
    source_generation: capabilityDecision.source_generation,
    binding_generation: capabilityDecision.binding_generation,
    evidence_id: capabilityDecision.evidence_id
  };
}

const capabilityForAction: Record<GuardAction, CameraCapabilityKey> = {
  ptz: "ptz", talk: "twoWayAudio", siren: "siren", lighting: "lighting"
};

export function discoverCameraCapabilities(input: {
  cameraId: string;
  cameraZoneName?: string | null;
  capabilities?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  sourceMode?: string | null;
}): CameraCapabilityManifest {
  const values = { ...(input.metadata ?? {}), ...(input.capabilities ?? {}) };
  const reportsSupport = (value: unknown) => value !== null && typeof value === "object"
    && "supported" in value && value.supported === true;
  const read = (...keys: string[]) => keys.some((key) => values[key] === true || values[key] === "true" || reportsSupport(values[key]));
  const detail = (key: CameraCapabilityKey, endpoint: string, extra: Partial<CameraCapabilityDetail> = {}): CameraCapabilityDetail => ({
    supported: read(key, `${key}_supported`), apiEndpoint: endpoint, requiresConfirmation: true, ...extra
  });
  const ptz = detail("ptz", "/control/ptz", { axes: ["pan", "tilt", "zoom"] });
  const twoWayAudio = detail("twoWayAudio", "/control/audio", { requiresConfirmation: true });
  const siren = detail("siren", "/control/siren", { requiresConfirmation: true });
  const lighting = detail("lighting", "/control/light", { states: ["on", "off", "dim"], requiresConfirmation: true });
  return {
    cameraId: input.cameraId,
    cameraZoneName: input.cameraZoneName?.trim() || "אזור ללא שם",
    discoveredAt: new Date().toISOString(),
    // Stored flags are descriptive only; only a fresh authenticated probe is evidence.
    source: Object.keys(values).length ? "metadata" : "unknown",
    capabilities: {
      ptz: ptz.supported,
      twoWayAudio: (twoWayAudio.supported = read("twoWayAudio", "two_way_audio", "talk", "talk_supported")),
      siren: siren.supported,
      lighting: (lighting.supported = read("lighting", "light", "light_supported", "floodlight"))
    },
    details: { ptz, twoWayAudio, siren, lighting }
  };
}

export function assertGuardActionAllowed(manifest: CameraCapabilityManifest, action: GuardAction, confirmed = false) {
  if (!manifest.capabilities[capabilityForAction[action]]) {
    throw new Error("CAMERA_CAPABILITY_UNAVAILABLE");
  }
  if (!confirmed) {
    throw new Error("HUMAN_CONFIRMATION_REQUIRED");
  }
  if (manifest.source !== "gateway") throw new Error("CAPABILITY_EVIDENCE_REQUIRED");
}

/**
 * Stored camera metadata is descriptive, not permission to actuate hardware.
 * Any physical adapter must independently verify fresh evidence, current human
 * confirmation, source scope and durable audit before dispatch.
 */
export class CameraDevice {
  readonly id: string;
  readonly manifest: CameraCapabilityManifest;
  constructor(input: Parameters<typeof discoverCameraCapabilities>[0]) {
    this.id = input.cameraId;
    this.manifest = discoverCameraCapabilities(input);
  }
  can(action: GuardAction) { return this.manifest.capabilities[capabilityForAction[action]]; }
  request(action: GuardAction, confirmed = false) {
    assertGuardActionAllowed(this.manifest, action, confirmed);
    if (this.manifest.source !== "gateway") throw new Error("CAPABILITY_EVIDENCE_REQUIRED");
    return { accepted: true, action, cameraId: this.id, requiresGatewayExecution: true, humanConfirmed: confirmed };
  }
}

export class DigitalGuardEngine {
  private readonly cameras = new Map<string, CameraDevice>();
  private readonly events: GuardEvent[] = [];

  constructor(private readonly diagnostics?: GuardDiagnosticAdapter) {}

  async requestCameraDiagnostics(input: GuardDiagnosticRequest) {
    if (!this.cameras.has(input.camera_source_id)) throw new Error("CAMERA_NOT_REGISTERED");
    if (!this.diagnostics) throw new Error("CAMERA_DIAGNOSTICS_UNAVAILABLE");
    return this.diagnostics.request(input);
  }

  async cameraDiagnosticStatus(input: GuardDiagnosticScope) {
    if (!this.cameras.has(input.camera_source_id)) throw new Error("CAMERA_NOT_REGISTERED");
    if (!this.diagnostics) throw new Error("CAMERA_DIAGNOSTICS_UNAVAILABLE");
    // Diagnostic evidence does not overwrite the command-capability manifest.
    return this.diagnostics.status(input);
  }

  registerCamera(input: Parameters<typeof discoverCameraCapabilities>[0]) {
    const device = new CameraDevice(input);
    this.cameras.set(device.id, device);
    return device.manifest;
  }
  camera(cameraId: string) { return this.cameras.get(cameraId) ?? null; }
  /**
   * Validate the live capability decision for a line-crossing alert. This is
   * deliberately a recommendation boundary: the Guard cannot self-authorize
   * a physical action; the dashboard must obtain immediate human approval.
   */
  recommendLineCrossingAction(cameraId: string, action: GuardAction = "lighting"): GuardActionRecommendation {
    const device = this.cameras.get(cameraId);
    const allowedActions = device
      ? (Object.keys(capabilityForAction) as GuardAction[]).filter((candidate) => device.can(candidate))
      : [];
    const allowed = Boolean(device?.manifest.source === "gateway" && device.can(action));
    return {
      cameraId,
      trigger: "LINE_CROSSING",
      action,
      allowed,
      allowedActions,
      requiresHumanConfirmation: true,
      reason: !device || !device.can(action) ? "capability_unavailable" : device.manifest.source !== "gateway" ? "gateway_evidence_required" : "capability_verified"
    };
  }
  ingest(event: GuardEvent) {
    if (!GUARD_EVENT_TYPES.includes(event.type)) throw new Error("UNKNOWN_GUARD_EVENT_TYPE");
    this.events.unshift({ ...event, requiresHumanReview: event.requiresHumanReview || event.severity === "critical" });
    return this.events[0];
  }
  recentEvents(cameraId?: string) { return this.events.filter((event) => !cameraId || event.cameraId === cameraId); }
}
