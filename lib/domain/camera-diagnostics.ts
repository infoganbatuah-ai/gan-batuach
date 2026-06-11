import { getCameraGardenId } from "@/lib/domain/parent-camera-access";
import { getCameraHealthStatus, summarizeCameraHealth } from "@/lib/domain/camera-health";
import { hasPlaybackSource, normalizeCameraSourceType } from "@/lib/domain/video-gateway";

export function isDemoCamera(camera: Record<string, any>) {
  return camera.is_demo === true || String(camera.name ?? "").startsWith("[DEMO]") || Boolean(camera.demo_batch_id);
}

export function parentViewingEnabled(camera: Record<string, any>) {
  return camera.parent_view_allowed === true || camera.parent_viewing_allowed === true;
}

export function sanitizeCameraForParent(camera: Record<string, any>) {
  return {
    id: camera.id,
    camera_garden_id: getCameraGardenId(camera),
    name: camera.name ?? "מצלמה",
    area: camera.area ?? null,
    status: camera.status ?? camera.stream_status ?? null,
    active: camera.active ?? null,
    viewing_hours: camera.viewing_hours ?? null,
    operating_hours: camera.operating_hours ?? null,
    parent_visibility_status: camera.parent_visibility_status ?? null,
    parent_blocked_reason: camera.parent_blocked_reason ?? null,
    last_health_check_at: camera.last_health_check_at ?? null,
    health_status: getCameraHealthStatus(camera),
    playback_source_available: hasPlaybackSource(camera)
  };
}

export function buildCameraAuditSummary(cameras: Array<Record<string, any>>) {
  const health = summarizeCameraHealth(cameras);
  const orphanCameras = cameras.filter((camera) => !getCameraGardenId(camera));
  const missingPlaybackSource = cameras.filter((camera) => !hasPlaybackSource(camera));
  const permissionIssues = cameras.filter((camera) => parentViewingEnabled(camera) && !getCameraGardenId(camera));
  const demoCameras = cameras.filter(isDemoCamera);
  return {
    ...health,
    demo: demoCameras.length,
    missingPlaybackSource: missingPlaybackSource.length,
    permissionIssues: permissionIssues.length,
    orphan: orphanCameras.length,
    productionReady: health.offline === 0 && permissionIssues.length === 0 && orphanCameras.length === 0
  };
}

export function describeCameraReadiness(camera: Record<string, any>) {
  const issues: string[] = [];
  if (!getCameraGardenId(camera)) issues.push("חסר שיוך לגן");
  if (!hasPlaybackSource(camera)) issues.push("חסר מקור צפייה");
  if (!parentViewingEnabled(camera)) issues.push("צפיית הורים כבויה");
  if (getCameraHealthStatus(camera) === "offline") issues.push("מצלמה לא מחוברת");
  if (camera.active === false) issues.push("מצלמה מושבתת");
  return {
    sourceType: normalizeCameraSourceType(camera.source_type ?? camera.camera_type ?? camera.protocol),
    healthStatus: getCameraHealthStatus(camera),
    playbackReady: hasPlaybackSource(camera),
    parentViewing: parentViewingEnabled(camera),
    gardenId: getCameraGardenId(camera),
    issues
  };
}
