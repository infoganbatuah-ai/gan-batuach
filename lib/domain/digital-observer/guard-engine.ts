/**
 * חוזי הליבה של התצפיתן הדיגיטלי.
 *
 * הקובץ intentionally אינו תלוי ב-Supabase או בספק AI. כך אפשר להחליף
 * Gateway/מודל בלי לשנות את מסכי המוצר, ובמקביל לשמור על מדיניות בטוחה:
 * אין פעולה פיזית בלי יכולת מדווחת ואישור אנושי.
 */

export const GUARD_EVENT_TYPES = [
  "ENTRY", "EXIT", "UNAUTHORIZED_FACE", "KNOWN_FACE", "VEHICLE_IN", "VEHICLE_OUT",
  "PERIMETER_BREACH", "LINE_CROSSING", "FIRE_SMOKE_ALERT", "POOL_HAZARD"
] as const;

export type GuardEventType = typeof GUARD_EVENT_TYPES[number];
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

export type GuardActionRecommendation = {
  cameraId: string;
  trigger: "LINE_CROSSING";
  action: GuardAction;
  allowed: boolean;
  allowedActions: GuardAction[];
  requiresHumanConfirmation: true;
  reason: "capability_verified" | "capability_unavailable" | "gateway_evidence_required";
};

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
  const read = (...keys: string[]) => keys.some((key) => values[key] === true || values[key] === "true" || (values[key] && typeof values[key] === "object" && (values[key] as any).supported === true));
  const detail = (key: CameraCapabilityKey, endpoint: string, extra: Partial<CameraCapabilityDetail> = {}): CameraCapabilityDetail => ({
    supported: read(key, `${key}_supported`), apiEndpoint: endpoint, requiresConfirmation: key !== "ptz", ...extra
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
 * The Digital Guard calls this only after a site policy has explicitly enabled
 * automated physical responses. The capability probe, online check and audit
 * claim still run through executeCameraAction; AI is not allowed to bypass them.
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
