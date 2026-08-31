/**
 * חוזי הליבה של התצפיתן הדיגיטלי.
 *
 * הקובץ intentionally אינו תלוי ב-Supabase או בספק AI. כך אפשר להחליף
 * Gateway/מודל בלי לשנות את מסכי המוצר, ובמקביל לשמור על מדיניות בטוחה:
 * אין פעולה פיזית בלי יכולת מדווחת ואישור אנושי.
 */

export const GUARD_EVENT_TYPES = [
  "ENTRY", "EXIT", "UNAUTHORIZED_FACE", "KNOWN_FACE", "VEHICLE_IN", "VEHICLE_OUT",
  "PERIMETER_BREACH", "FIRE_SMOKE_ALERT", "POOL_HAZARD"
] as const;

export type GuardEventType = typeof GUARD_EVENT_TYPES[number];
export type CameraCapabilityKey = "ptz" | "twoWayAudio" | "siren" | "lighting";

export type CameraCapabilityManifest = {
  cameraId: string;
  cameraZoneName: string;
  discoveredAt: string;
  source: "gateway" | "metadata" | "unknown";
  capabilities: Record<CameraCapabilityKey, boolean>;
  raw?: Record<string, unknown>;
};

export type CameraCapabilityProbe = {
  manifest: CameraCapabilityManifest;
  evidenceId: string;
  verifiedAt: string;
  gatewayProvider: string;
};

export interface CameraCommandAdapter {
  execute(command: { cameraId: string; action: GuardAction; payload?: Record<string, unknown> }): Promise<{ acknowledged: boolean; commandId: string }>;
}

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
  const read = (...keys: string[]) => keys.some((key) => values[key] === true || values[key] === "true");
  const hasGateway = Boolean(values.capability_manifest_verified === true || values.capability_probe_id || values.gateway_capability_evidence === true);
  return {
    cameraId: input.cameraId,
    cameraZoneName: input.cameraZoneName?.trim() || "אזור ללא שם",
    discoveredAt: new Date().toISOString(),
    source: hasGateway ? "gateway" : Object.keys(values).length ? "metadata" : "unknown",
    capabilities: {
      ptz: read("ptz", "PTZ", "ptz_supported"),
      twoWayAudio: read("twoWayAudio", "two_way_audio", "talk", "talk_supported"),
      siren: read("siren", "siren_supported"),
      lighting: read("lighting", "light", "light_supported", "floodlight")
    },
    raw: values
  };
}

export function assertGuardActionAllowed(manifest: CameraCapabilityManifest, action: GuardAction, confirmed = false) {
  if (!manifest.capabilities[capabilityForAction[action]]) {
    throw new Error("CAMERA_CAPABILITY_UNAVAILABLE");
  }
  if ((action === "siren" || action === "talk") && !confirmed) {
    throw new Error("HUMAN_CONFIRMATION_REQUIRED");
  }
}

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

  registerCamera(input: Parameters<typeof discoverCameraCapabilities>[0]) {
    const device = new CameraDevice(input);
    this.cameras.set(device.id, device);
    return device.manifest;
  }
  camera(cameraId: string) { return this.cameras.get(cameraId) ?? null; }
  ingest(event: GuardEvent) {
    if (!GUARD_EVENT_TYPES.includes(event.type)) throw new Error("UNKNOWN_GUARD_EVENT_TYPE");
    this.events.unshift({ ...event, requiresHumanReview: event.requiresHumanReview || event.severity === "critical" });
    return this.events[0];
  }
  recentEvents(cameraId?: string) { return this.events.filter((event) => !cameraId || event.cameraId === cameraId); }
}
