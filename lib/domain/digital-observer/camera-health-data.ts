/* eslint-disable @typescript-eslint/no-explicit-any -- canonical health reads migration-backed metadata pending generated types. */
import { createAdminClient } from "@/lib/supabase/admin";
import { projectCameraHealth, summarizeSiteHealth, type CameraHealthProjection } from "./camera-health-model";

function object(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function text(...values: unknown[]) { const value = values.find(item => typeof item === "string" && item.length); return typeof value === "string" ? value : null; }

export async function loadCameraHealthSnapshot(siteId: string, now = Date.now()) {
  const admin = createAdminClient() as any;
  const [sources, devices] = await Promise.all([
    admin.from("digital_observer_camera_sources").select("id,observer_site_id,display_name,status,health_status,last_seen_at,last_health_check_at,metadata,capabilities,connector_type").eq("observer_site_id", siteId).order("created_at"),
    admin.from("video_gateway_device_enrollments").select("id,gateway_id,observer_site_id,lifecycle_state,last_seen_at,metadata,deployment_profile").eq("observer_site_id", siteId)
  ]);
  if (sources.error || devices.error) throw new Error("CAMERA_HEALTH_READ_FAILED");
  const deviceByGateway = new Map<string, any>((devices.data ?? []).map((device: any) => [String(device.gateway_id), device]));
  const cameras: CameraHealthProjection[] = (sources.data ?? []).map((source: any) => {
    const metadata = object(source.metadata); const capabilities = object(source.capabilities); const health = object(metadata.health);
    const playback = object(metadata.playback_health); const ai = object(metadata.ai_health); const recovery = object(metadata.supervision); const recording = object(metadata.recording_health);
    const gatewayId = text(metadata.gateway_id, metadata.connector_gateway_id, metadata.device_id); const device = gatewayId ? deviceByGateway.get(gatewayId) : null;
    const deviceMetadata = object(device?.metadata); const deviceHealth = object(deviceMetadata.health); const offline = object(deviceMetadata.offline_buffer);
    return projectCameraHealth({ id: source.id, siteId, name: source.display_name || "Camera", componentId: gatewayId,
      channelAssignment: text(metadata.channel_assignment, metadata.channel_state), physicalCameraAttached: metadata.physical_camera_attached,
      critical: metadata.critical_camera === true || metadata.critical_zone === true,
      sourceState: text(health.source, source.status, source.health_status), relayState: text(health.relay, metadata.relay_state, source.status),
      playbackState: text(playback.state, metadata.playback_state, capabilities.live_view === false ? "FAILED" : null),
      aiState: text(ai.state, metadata.ai_state, capabilities.object_detection === true ? "HEALTHY" : null),
      componentState: text(deviceHealth.status, device?.lifecycle_state === "ACTIVE" ? "HEALTHY" : device?.lifecycle_state),
      authState: text(deviceHealth.authentication, device?.lifecycle_state === "ACTIVE" ? "HEALTHY" : device?.lifecycle_state),
      cloudState: text(deviceHealth.cloud, offline.state === "OFFLINE" ? "OFFLINE" : "HEALTHY"), recordingState: text(recording.state, metadata.recording_state),
      resyncState: text(offline.state, metadata.resync_state), recoveryState: text(recovery.state, metadata.recovery_state),
      lastFrameAt: text(health.last_frame_at, metadata.last_frame_at, source.last_seen_at, source.last_health_check_at),
      lastHeartbeatAt: text(device?.last_seen_at, source.last_health_check_at), lastPlaybackAt: text(playback.last_verified_at, metadata.last_playback_verified_at),
      lastInferenceAt: text(ai.last_progress_at, metadata.last_inference_at), failureDetectedAt: text(health.failure_detected_at, metadata.failure_detected_at),
      recoveryStartedAt: text(recovery.started_at, metadata.recovery_started_at), recoveryCompletedAt: text(recovery.completed_at, metadata.recovery_completed_at)
    }, { now });
  });
  return { generatedAt: new Date(now).toISOString(), siteId, cameras, site: summarizeSiteHealth(cameras), components: (devices.data ?? []).map((device: any) => ({
    id: device.gateway_id, profile: device.deployment_profile, lifecycleState: device.lifecycle_state, lastSeenAt: device.last_seen_at,
    dependentCameraCount: cameras.filter(camera => camera.rootCause?.componentId === device.gateway_id || (sources.data ?? []).some((source: any) => source.id === camera.cameraId && [object(source.metadata).gateway_id, object(source.metadata).connector_gateway_id, object(source.metadata).device_id].includes(device.gateway_id))).length
  })) };
}
