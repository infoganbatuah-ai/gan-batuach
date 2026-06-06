import { buildRtspCandidates, type CameraConnectionInput } from "@/lib/domain/camera-connection-builder";
import { getCameraHealthStatus, summarizeCameraHealth } from "@/lib/domain/camera-health";
import { hasPlaybackSource } from "@/lib/domain/video-gateway";
import { isGatewayConfigured } from "@/lib/domain/video-gateway-client";

export type CameraProviderKey = "hikvision" | "dahua" | "uniview" | "axis" | "generic_rtsp" | "nvr" | "dvr";

export const cameraProviderRegistry: Record<CameraProviderKey, { name: string; capabilities: Record<string, boolean>; defaultRtspPort: number }> = {
  hikvision: { name: "Hikvision", capabilities: { rtsp: true, onvif: true, dvr: true, nvr: true, recording_ready: true }, defaultRtspPort: 554 },
  dahua: { name: "Dahua", capabilities: { rtsp: true, onvif: true, dvr: true, nvr: true, recording_ready: true }, defaultRtspPort: 554 },
  uniview: { name: "Uniview", capabilities: { rtsp: true, onvif: true, dvr: true, nvr: true, recording_ready: true }, defaultRtspPort: 554 },
  axis: { name: "Axis", capabilities: { rtsp: true, onvif: true, ip_camera: true, recording_ready: true }, defaultRtspPort: 554 },
  generic_rtsp: { name: "Generic RTSP", capabilities: { rtsp: true, manual_rtsp: true, recording_ready: true }, defaultRtspPort: 554 },
  nvr: { name: "Generic NVR", capabilities: { rtsp: true, nvr: true, multi_channel: true, recording_ready: true }, defaultRtspPort: 554 },
  dvr: { name: "Generic DVR", capabilities: { rtsp: true, dvr: true, multi_channel: true, recording_ready: true }, defaultRtspPort: 554 }
};

export function inferCameraProvider(camera: Record<string, any>): CameraProviderKey {
  const text = `${camera.provider_key ?? ""} ${camera.system_type ?? ""} ${camera.camera_type ?? ""} ${camera.source_type ?? ""} ${camera.rtsp_template ?? ""}`.toLowerCase();
  if (text.includes("hikvision")) return "hikvision";
  if (text.includes("dahua")) return "dahua";
  if (text.includes("uniview")) return "uniview";
  if (text.includes("axis")) return "axis";
  if (text.includes("nvr")) return "nvr";
  if (text.includes("dvr")) return "dvr";
  return "generic_rtsp";
}

export function validateCameraStreamReadiness(input: CameraConnectionInput & { provider_key?: string | null }) {
  const started = Date.now();
  const candidates = buildRtspCandidates(input);
  const gatewayConfigured = isGatewayConfigured();
  const hasHost = Boolean(input.host || input.manual_rtsp_url || input.sample_hls_url);
  const hasCredentials = Boolean(input.username && input.password);
  const isSample = input.system_type === "sample_hls" && Boolean(input.sample_hls_url);
  const status = isSample ? "success" : gatewayConfigured && hasHost ? "pending" : "gateway_required";
  return {
    status,
    rtspValid: candidates.length > 0 || isSample,
    connectionValid: gatewayConfigured && hasHost,
    credentialsValid: hasCredentials || input.system_type === "sample_hls" || input.system_type === "manual_rtsp",
    streamAvailable: isSample,
    latencyMs: Date.now() - started,
    candidatesTriedCount: candidates.length,
    gatewayRequired: !gatewayConfigured,
    message: isSample
      ? "Sample HLS מוכן לבדיקה"
      : gatewayConfigured
        ? "מוכן לבדיקת Gateway אמיתית"
        : "נדרש חיבור Video Gateway לפני בדיקת שידור אמיתית",
    noSecretsExposed: true
  };
}

export function buildCameraInfrastructureSummary(cameras: Array<Record<string, any>>, validations: Array<Record<string, any>> = [], sessions: Array<Record<string, any>> = []) {
  const health = summarizeCameraHealth(cameras);
  const providerCounts = cameras.reduce<Record<string, number>>((acc, camera) => {
    const provider = inferCameraProvider(camera);
    acc[provider] = (acc[provider] ?? 0) + 1;
    return acc;
  }, {});
  const recordingReady = cameras.filter((camera) => camera.recording_enabled && (camera.retention_days || camera.recording_retention_days)).length;
  const storageReady = cameras.filter((camera) => camera.storage_location || camera.recording_storage_location || camera.storage_provider).length;
  const hlsReady = cameras.filter((camera) => Boolean(camera.hls_playback_url || camera.sample_hls_url || camera.playback_hls_ready)).length;
  const webrtcReady = cameras.filter((camera) => Boolean(camera.webrtc_playback_url || camera.playback_webrtc_ready)).length;
  const playbackReady = cameras.filter(hasPlaybackSource).length;
  const degraded = cameras.filter((camera) => getCameraHealthStatus(camera) === "warning" || String(camera.health_status ?? "").toLowerCase() === "degraded").length;
  const failedValidations = validations.filter((item) => item.status === "failed").length;
  return {
    ...health,
    degraded,
    providerCounts,
    recordingReady,
    recordingPending: Math.max(0, cameras.length - recordingReady),
    storageReady,
    storagePending: Math.max(0, cameras.length - storageReady),
    hlsReady,
    webrtcReady,
    playbackReady,
    playbackSessions: sessions.length,
    failedValidations,
    gatewayConfigured: isGatewayConfigured(),
    productionReady: health.offline === 0 && degraded === 0 && playbackReady === cameras.length && cameras.length > 0
  };
}

export function cameraDiagnosticsFor(camera: Record<string, any>) {
  const provider = inferCameraProvider(camera);
  const healthStatus = getCameraHealthStatus(camera);
  const playbackReady = hasPlaybackSource(camera);
  const gatewayConfigured = isGatewayConfigured();
  const recordingConfigured = Boolean(camera.recording_enabled && (camera.retention_days || camera.recording_retention_days));
  const storageConfigured = Boolean(camera.storage_location || camera.recording_storage_location || camera.storage_provider);
  return {
    provider,
    providerName: cameraProviderRegistry[provider].name,
    connectivity: healthStatus === "online" ? "online" : healthStatus,
    latencyMs: camera.gateway_latency_ms ?? camera.validation_latency_ms ?? null,
    healthStatus,
    registrationStatus: camera.gateway_registration_status ?? camera.connection_method ?? "pending_gateway",
    playback: {
      hlsReady: Boolean(camera.hls_playback_url || camera.sample_hls_url || camera.playback_hls_ready),
      webrtcReady: Boolean(camera.webrtc_playback_url || camera.playback_webrtc_ready),
      sourceAvailable: playbackReady
    },
    recording: {
      enabled: Boolean(camera.recording_enabled),
      configured: recordingConfigured,
      retentionDays: camera.retention_days ?? camera.recording_retention_days ?? null,
      implemented: false
    },
    storage: {
      configured: storageConfigured,
      mode: camera.storage_mode ?? "not_configured",
      provider: camera.storage_provider ?? null,
      estimatedDailyMb: Number(camera.estimated_daily_storage_mb ?? 0)
    },
    observer: {
      aiObserverReady: playbackReady && gatewayConfigured,
      learningReady: Boolean(camera.observer_site_id || camera.garden_id || camera.kindergarten_id),
      correlationReady: playbackReady
    },
    safe: {
      noRtspExposed: true,
      noPasswordExposed: true,
      gatewayRequired: !gatewayConfigured
    }
  };
}
