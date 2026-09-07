const connectedStatuses = new Set(["connected", "healthy", "online", "active"]);
const unavailableStatuses = new Set(["offline", "failed", "error", "disabled", "blocked"]);

type CameraStatusInput = {
  metadata?: Record<string, unknown> | null;
  gateway_stream_id?: unknown;
  video_gateway_stream_id?: unknown;
  status?: unknown;
  health_status?: unknown;
  last_seen_at?: unknown;
  last_health_check_at?: unknown;
  updated_at?: unknown;
};

export const DIGITAL_OBSERVER_CAMERA_FRESH_MS = 45 * 60 * 1000;
export const DIGITAL_OBSERVER_CAMERA_RECOVERY_MS = 90 * 60 * 1000;
export type DigitalObserverCameraOperationalState = "ONLINE" | "RECOVERING" | "OFFLINE" | "CHANNEL_EMPTY";

export function digitalObserverCameraStreamReference(camera: CameraStatusInput) {
  const value = camera.metadata?.canonical_stream_reference
    ?? camera.metadata?.gateway_stream_id
    ?? camera.gateway_stream_id
    ?? camera.video_gateway_stream_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const digitalObserverGatewayStreamId = digitalObserverCameraStreamReference;

export function digitalObserverCameraIsAssigned(camera: CameraStatusInput) {
  return camera.metadata?.channel_assignment !== "CHANNEL_EMPTY" && camera.metadata?.physical_camera_attached !== false;
}

export function digitalObserverCameraIsConnected(camera: CameraStatusInput) {
  const status = String(camera.status ?? "").toLowerCase();
  const health = String(camera.health_status ?? "").toLowerCase();
  if (unavailableStatuses.has(status) || unavailableStatuses.has(health)) return false;
  return connectedStatuses.has(status) || connectedStatuses.has(health);
}

function latestCameraActivityAt(camera: CameraStatusInput) {
  const values = [camera.last_seen_at, camera.last_health_check_at]
    .map((value) => typeof value === "string" ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

export function digitalObserverCameraOperationalState(
  camera: CameraStatusInput,
  options: { now?: number; freshMs?: number; recoveryMs?: number } = {}
): DigitalObserverCameraOperationalState {
  if (!digitalObserverCameraIsAssigned(camera)) return "CHANNEL_EMPTY";
  const status = String(camera.status ?? "").toLowerCase();
  const health = String(camera.health_status ?? "").toLowerCase();
  if (unavailableStatuses.has(status) || unavailableStatuses.has(health)) return "OFFLINE";
  const lastActivityAt = latestCameraActivityAt(camera);
  if (digitalObserverCameraIsConnected(camera)) {
    if (lastActivityAt === null) return "OFFLINE";
    const age = Math.max(0, (options.now ?? Date.now()) - lastActivityAt);
    if (age <= (options.freshMs ?? DIGITAL_OBSERVER_CAMERA_FRESH_MS)) return "ONLINE";
    if (age <= (options.recoveryMs ?? DIGITAL_OBSERVER_CAMERA_RECOVERY_MS)) return "RECOVERING";
    return "OFFLINE";
  }
  return ["connecting", "reconnecting", "readiness", "ready_to_test", "testing"].includes(status)
    ? "RECOVERING"
    : "OFFLINE";
}

export function digitalObserverCameraHealthProjection(camera: CameraStatusInput, now = Date.now()) {
  const operationalState = digitalObserverCameraOperationalState(camera, { now });
  if (operationalState === "CHANNEL_EMPTY") return { operationalState, status: "unassigned", healthStatus: "unknown", live: false };
  if (operationalState === "ONLINE") return { operationalState, status: "connected", healthStatus: "healthy", live: true };
  if (operationalState === "RECOVERING") return { operationalState, status: "recovering", healthStatus: "degraded", live: false };
  return { operationalState, status: "offline", healthStatus: "offline", live: false };
}

export function digitalObserverCameraHasLiveStream(camera: CameraStatusInput) {
  return Boolean(digitalObserverCameraStreamReference(camera) && digitalObserverCameraOperationalState(camera) === "ONLINE");
}

// Compatibility alias for callers written before the vendor-agnostic source contract.
export const digitalObserverCameraHasLiveGateway = digitalObserverCameraHasLiveStream;
