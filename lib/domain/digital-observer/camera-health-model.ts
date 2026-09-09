export const CAMERA_HEALTH_CONTRACT = "observer-camera-health-v1" as const;

export const CAMERA_HEALTH_REASONS = [
  "CHANNEL_EMPTY", "SOURCE_UNREACHABLE", "FRAME_STALE", "RELAY_FAILED", "PLAYBACK_FAILED",
  "AI_STALLED", "COMPONENT_OFFLINE", "AUTH_DEGRADED", "CLOUD_UNAVAILABLE", "RESYNC_PENDING",
  "RECOVERING", "FLAPPING", "EVIDENCE_PENDING", "RECORDING_UNAVAILABLE"
] as const;
export type CameraHealthReason = typeof CAMERA_HEALTH_REASONS[number];
export type HealthState = "HEALTHY" | "RECOVERING" | "DEGRADED" | "OFFLINE" | "ACTION_REQUIRED" | "EMPTY" | "UNKNOWN";
export type HealthDimension = { state: HealthState; reason: CameraHealthReason | null; observedAt: string | null; expiresAt: string | null };

export type CameraHealthInput = {
  id: string; siteId: string; name: string; componentId?: string | null;
  channelAssignment?: string | null; physicalCameraAttached?: boolean | null; critical?: boolean;
  sourceState?: string | null; relayState?: string | null; playbackState?: string | null; aiState?: string | null;
  componentState?: string | null; authState?: string | null; cloudState?: string | null; recordingState?: string | null;
  resyncState?: string | null; recoveryState?: string | null;
  lastFrameAt?: string | null; lastHeartbeatAt?: string | null; lastPlaybackAt?: string | null; lastInferenceAt?: string | null;
  failureDetectedAt?: string | null; recoveryStartedAt?: string | null; recoveryCompletedAt?: string | null;
};

export type CameraHealthProjection = {
  contract: typeof CAMERA_HEALTH_CONTRACT; cameraId: string; siteId: string; name: string; expected: boolean; critical: boolean;
  summary: HealthState; reasons: CameraHealthReason[]; rootCause: { kind: "COMPONENT" | "SOURCE" | "UNKNOWN"; componentId: string | null; confidence: "CONFIRMED" | "INFERRED" } | null;
  dimensions: { source: HealthDimension; frame: HealthDimension; relay: HealthDimension; playback: HealthDimension; ai: HealthDimension; component: HealthDimension; authentication: HealthDimension; cloud: HealthDimension; recording: HealthDimension };
  timestamps: { lastFrameAt: string | null; lastHeartbeatAt: string | null; lastPlaybackAt: string | null; lastInferenceAt: string | null; failureDetectedAt: string | null; recoveryStartedAt: string | null; recoveryCompletedAt: string | null };
};

export function isExpectedCamera(input: Pick<CameraHealthInput, "channelAssignment" | "physicalCameraAttached">) {
  return input.channelAssignment !== "CHANNEL_EMPTY" && input.channelAssignment !== "UNASSIGNED" && input.physicalCameraAttached !== false;
}

const bad = new Set(["OFFLINE", "FAILED", "ERROR", "UNREACHABLE", "STALLED", "UNHEALTHY"]);
const degraded = new Set(["DEGRADED", "WARNING", "PENDING", "RESYNCING", "RECOVERING"]);
const good = new Set(["HEALTHY", "ONLINE", "CONNECTED", "ACTIVE", "READY", "AVAILABLE", "PROGRESSING", "SYNCHRONIZED"]);
const upper = (value: unknown) => String(value ?? "UNKNOWN").toUpperCase();
const time = (value?: string | null) => { const parsed = value ? Date.parse(value) : Number.NaN; return Number.isFinite(parsed) ? parsed : null; };
function dimension(state: HealthState, reason: CameraHealthReason | null, observedAt: string | null, ttlMs: number | null): HealthDimension {
  const observed = time(observedAt); return { state, reason, observedAt, expiresAt: observed !== null && ttlMs !== null ? new Date(observed + ttlMs).toISOString() : null };
}
function statusDimension(value: unknown, reason: CameraHealthReason, observedAt: string | null): HealthDimension {
  const state = upper(value); if (good.has(state)) return dimension("HEALTHY", null, observedAt, null);
  if (bad.has(state)) return dimension("OFFLINE", reason, observedAt, null);
  if (degraded.has(state)) return dimension(state === "RECOVERING" ? "RECOVERING" : "DEGRADED", state === "RECOVERING" ? "RECOVERING" : reason, observedAt, null);
  return dimension("UNKNOWN", null, observedAt, null);
}
function freshness(value: string | null | undefined, now: number, ttlMs: number, reason: CameraHealthReason): HealthDimension {
  const observed = time(value); if (observed === null) return dimension("UNKNOWN", null, null, null);
  return observed + ttlMs >= now ? dimension("HEALTHY", null, value ?? null, ttlMs) : dimension("OFFLINE", reason, value ?? null, ttlMs);
}

export function projectCameraHealth(input: CameraHealthInput, options: { now?: number; frameTtlMs?: number; heartbeatTtlMs?: number; playbackTtlMs?: number; inferenceTtlMs?: number } = {}): CameraHealthProjection {
  const now = options.now ?? Date.now(); const expected = isExpectedCamera(input);
  const timestamps = { lastFrameAt: input.lastFrameAt ?? null, lastHeartbeatAt: input.lastHeartbeatAt ?? null, lastPlaybackAt: input.lastPlaybackAt ?? null, lastInferenceAt: input.lastInferenceAt ?? null,
    failureDetectedAt: input.failureDetectedAt ?? null, recoveryStartedAt: input.recoveryStartedAt ?? null, recoveryCompletedAt: input.recoveryCompletedAt ?? null };
  if (!expected) {
    const empty = dimension("EMPTY", "CHANNEL_EMPTY", null, null);
    return { contract: CAMERA_HEALTH_CONTRACT, cameraId: input.id, siteId: input.siteId, name: input.name, expected: false, critical: false, summary: "EMPTY", reasons: ["CHANNEL_EMPTY"], rootCause: null,
      dimensions: { source: empty, frame: empty, relay: empty, playback: empty, ai: empty, component: empty, authentication: empty, cloud: empty, recording: empty }, timestamps };
  }
  const component = statusDimension(input.componentState, "COMPONENT_OFFLINE", input.lastHeartbeatAt ?? null);
  const heartbeat = freshness(input.lastHeartbeatAt, now, options.heartbeatTtlMs ?? 180_000, "COMPONENT_OFFLINE");
  const componentTruth = heartbeat.state === "OFFLINE" ? heartbeat : component;
  const source = statusDimension(input.sourceState, "SOURCE_UNREACHABLE", input.lastFrameAt ?? null);
  const frame = freshness(input.lastFrameAt, now, options.frameTtlMs ?? 120_000, "FRAME_STALE");
  const relay = statusDimension(input.relayState, "RELAY_FAILED", input.lastFrameAt ?? null);
  const playback = input.playbackState == null ? dimension("UNKNOWN", null, input.lastPlaybackAt ?? null, null)
    : statusDimension(input.playbackState, "PLAYBACK_FAILED", input.lastPlaybackAt ?? null);
  const playbackTruth = playback.state === "HEALTHY" && input.lastPlaybackAt ? freshness(input.lastPlaybackAt, now, options.playbackTtlMs ?? 300_000, "PLAYBACK_FAILED") : playback;
  const ai = input.aiState == null ? dimension("UNKNOWN", null, input.lastInferenceAt ?? null, null) : statusDimension(input.aiState, "AI_STALLED", input.lastInferenceAt ?? null);
  const aiTruth = ai.state === "HEALTHY" && input.lastInferenceAt ? freshness(input.lastInferenceAt, now, options.inferenceTtlMs ?? 600_000, "AI_STALLED") : ai;
  const authentication = statusDimension(input.authState, "AUTH_DEGRADED", input.lastHeartbeatAt ?? null);
  const cloud = statusDimension(input.cloudState, "CLOUD_UNAVAILABLE", input.lastHeartbeatAt ?? null);
  const recording = statusDimension(input.recordingState, "RECORDING_UNAVAILABLE", input.lastFrameAt ?? null);
  const dimensions = { source, frame, relay, playback: playbackTruth, ai: aiTruth, component: componentTruth, authentication, cloud, recording };
  const reasons = Object.values(dimensions).map(item => item.reason).filter((value): value is CameraHealthReason => Boolean(value));
  if (upper(input.resyncState) === "RESYNCING" || upper(input.resyncState) === "PENDING") reasons.push("RESYNC_PENDING");
  const recovering = upper(input.recoveryState) === "RECOVERING";
  if (recovering) reasons.push("RECOVERING");
  const authAction = authentication.state === "OFFLINE"; const infrastructureOffline = componentTruth.state === "OFFLINE";
  const sourceOffline = source.state === "OFFLINE" || frame.state === "OFFLINE" || relay.state === "OFFLINE";
  const anyDegraded = Object.values(dimensions).some(item => ["DEGRADED", "OFFLINE"].includes(item.state)) || reasons.includes("RESYNC_PENDING");
  const summary: HealthState = recovering ? "RECOVERING" : authAction ? "ACTION_REQUIRED" : infrastructureOffline || sourceOffline ? "OFFLINE" : anyDegraded ? "DEGRADED" : "HEALTHY";
  const rootCause = infrastructureOffline && input.componentId ? { kind: "COMPONENT" as const, componentId: input.componentId, confidence: "CONFIRMED" as const }
    : sourceOffline ? { kind: "SOURCE" as const, componentId: input.componentId ?? null, confidence: "INFERRED" as const } : null;
  return { contract: CAMERA_HEALTH_CONTRACT, cameraId: input.id, siteId: input.siteId, name: input.name, expected, critical: Boolean(input.critical), summary, reasons: [...new Set(reasons)], rootCause, dimensions, timestamps };
}

export function detectHealthFlapping(transitions: Array<{ state: HealthState; at: string }>, options: { windowMs?: number; threshold?: number; now?: number } = {}) {
  const since = (options.now ?? Date.now()) - (options.windowMs ?? 15 * 60_000);
  const recent = transitions.filter(item => (time(item.at) ?? 0) >= since).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let changes = 0; for (let index = 1; index < recent.length; index++) if (recent[index].state !== recent[index - 1].state) changes++;
  return { flapping: changes >= (options.threshold ?? 4), transitions: changes, reason: changes >= (options.threshold ?? 4) ? "FLAPPING" as const : null };
}

export function summarizeSiteHealth(cameras: CameraHealthProjection[]) {
  const expected = cameras.filter(camera => camera.expected); const empty = cameras.filter(camera => !camera.expected);
  const healthy = expected.filter(camera => camera.summary === "HEALTHY"); const criticalFailures = expected.filter(camera => camera.critical && !["HEALTHY", "RECOVERING"].includes(camera.summary));
  const summary: HealthState = criticalFailures.length ? "ACTION_REQUIRED" : expected.some(camera => camera.summary === "OFFLINE") ? "OFFLINE"
    : expected.some(camera => camera.summary === "RECOVERING") ? "RECOVERING" : expected.some(camera => camera.summary === "DEGRADED") ? "DEGRADED" : "HEALTHY";
  const componentCauses = new Map<string, string[]>(); for (const camera of expected) if (camera.rootCause?.kind === "COMPONENT" && camera.rootCause.componentId) {
    const current = componentCauses.get(camera.rootCause.componentId) ?? []; current.push(camera.cameraId); componentCauses.set(camera.rootCause.componentId, current);
  }
  return { contract: CAMERA_HEALTH_CONTRACT, summary, configuredCapacity: cameras.length, expectedPhysicalCameras: expected.length, healthyExpectedCameras: healthy.length,
    emptyChannels: empty.length, expectedAvailability: expected.length ? healthy.length / expected.length : null, criticalFailures: criticalFailures.length,
    commonCauses: [...componentCauses.entries()].map(([componentId, cameraIds]) => ({ componentId, affectedCameraIds: cameraIds, affectedCount: cameraIds.length, dedupeKey: `component:${componentId}` })) };
}
