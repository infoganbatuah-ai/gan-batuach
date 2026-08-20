import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCameraStatus } from "@/lib/domain/video-gateway";
import { CAMERA_BROWSER_SAFE_SELECT } from "@/lib/domain/camera-safe-columns";

export type CameraHealthSummary = {
  total: number;
  online: number;
  offline: number;
  warning: number;
  pending: number;
  disabled: number;
};

export function getCameraHealthStatus(camera: Record<string, any>) {
  const operational = normalizeCameraStatus(camera.stream_status ?? camera.status, camera.active !== false);
  const health = String(camera.health_status ?? "").toLowerCase();
  if (operational === "disabled") return "disabled";
  if (operational === "connected" && ["healthy", "ok", "connected", ""].includes(health)) return "online";
  if (operational === "connected" && ["warning", "degraded"].includes(health)) return "warning";
  if (operational === "pending" || operational === "connecting") return "pending";
  return "offline";
}

export function summarizeCameraHealth(cameras: Array<Record<string, any>>): CameraHealthSummary {
  return cameras.reduce<CameraHealthSummary>((summary, camera) => {
    summary.total += 1;
    const status = getCameraHealthStatus(camera);
    if (status === "online") summary.online += 1;
    if (status === "offline") summary.offline += 1;
    if (status === "warning") summary.warning += 1;
    if (status === "pending") summary.pending += 1;
    if (status === "disabled") summary.disabled += 1;
    return summary;
  }, { total: 0, online: 0, offline: 0, warning: 0, pending: 0, disabled: 0 });
}

export async function recordCameraHealthCheck(
  supabase: SupabaseClient<any, any, any>,
  camera: Record<string, any>,
  payload: { offline?: boolean; warning?: boolean; metadata?: Record<string, unknown> } = {}
) {
  const now = new Date().toISOString();
  const streamStatus = camera.active === false ? "disabled" : payload.offline ? "offline" : "connected";
  const healthStatus = camera.active === false ? "disabled" : payload.offline ? "offline" : payload.warning ? "warning" : "healthy";
  const updates = {
    stream_status: streamStatus,
    health_status: healthStatus,
    last_seen: payload.offline ? camera.last_seen ?? null : now,
    last_stream_activity_at: payload.offline ? camera.last_stream_activity_at ?? null : now,
    last_successful_connection_at: payload.offline ? camera.last_successful_connection_at ?? null : now,
    failure_count: payload.offline ? Number(camera.failure_count ?? 0) + 1 : Number(camera.failure_count ?? 0),
    reconnect_attempts: payload.offline ? Number(camera.reconnect_attempts ?? 0) + 1 : Number(camera.reconnect_attempts ?? 0),
    health_summary: { ...(camera.health_summary ?? {}), last_check_at: now, ...(payload.metadata ?? {}) },
    status: streamStatus === "connected" ? "connected" : streamStatus
  };
  const { data, error } = await supabase
    .from("camera_streams" as any)
    .update(updates)
    .eq("id", camera.id)
    .select(CAMERA_BROWSER_SAFE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
