import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptField } from "@/lib/security/encryption";

export const cameraSourceTypes = ["RTSP", "ONVIF", "DVR", "NVR", "HLS", "WebRTC", "Sample HLS"] as const;
export type CameraSourceType = (typeof cameraSourceTypes)[number];

export const cameraOperationalStatuses = ["connected", "connecting", "pending", "offline", "error", "disabled"] as const;
export type CameraOperationalStatus = (typeof cameraOperationalStatuses)[number];

export function normalizeCameraSourceType(value?: string | null): CameraSourceType {
  const normalized = String(value ?? "RTSP").trim().toLowerCase();
  if (normalized.includes("sample")) return "Sample HLS";
  if (normalized === "hls") return "HLS";
  if (normalized === "webrtc") return "WebRTC";
  if (normalized === "onvif") return "ONVIF";
  if (normalized === "dvr") return "DVR";
  if (normalized === "nvr") return "NVR";
  return "RTSP";
}

export function normalizeCameraStatus(value?: string | null, active = true): CameraOperationalStatus {
  if (!active) return "disabled";
  const normalized = String(value ?? "pending").trim().toLowerCase();
  if (["connected", "online"].includes(normalized)) return "connected";
  if (["connecting"].includes(normalized)) return "connecting";
  if (["offline", "failed"].includes(normalized)) return "offline";
  if (["error"].includes(normalized)) return "error";
  if (["disabled"].includes(normalized)) return "disabled";
  return "pending";
}

export function isVideoGatewayConfigured() {
  return Boolean(process.env.VIDEO_GATEWAY_URL);
}

export function hasPlaybackSource(camera: Record<string, unknown>) {
  return Boolean(
    camera.sample_hls_url ||
    camera.hls_playback_url ||
    camera.webrtc_playback_url ||
    camera.gateway_stream_id ||
    camera.video_gateway_stream_id
  );
}

export function buildCameraGatewayDescriptor(camera: Record<string, unknown>) {
  const sourceType = normalizeCameraSourceType(String(camera.source_type ?? camera.camera_type ?? camera.protocol ?? "RTSP"));
  return {
    sourceType,
    status: normalizeCameraStatus(String(camera.stream_status ?? camera.status ?? "pending"), camera.active !== false),
    gatewayConfigured: isVideoGatewayConfigured(),
    playbackReady: hasPlaybackSource(camera),
    recordingReady: Boolean(camera.recording_enabled),
    recordingImplemented: false
  };
}

export const onvifDiscoverySchema = z.object({
  garden_id: z.string().uuid(),
  network_cidr: z.string(),
  username: z.string().optional(),
  password: z.string().optional()
});

export const rtspIngestSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid().optional(),
  name: z.string().min(2),
  area: z.string().min(2),
  rtsp_url: z.string().min(8),
  username: z.string().optional(),
  password: z.string().optional()
});

export const dvrConnectionSchema = z.object({
  garden_id: z.string().uuid(),
  connection_type: z.enum(["dvr", "nvr", "onvif", "rtsp"]),
  endpoint: z.string().min(3),
  port: z.number().int().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const streamHealthSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid(),
  black_screen: z.boolean().default(false),
  frozen: z.boolean().default(false),
  offline: z.boolean().default(false),
  covered: z.boolean().default(false),
  frame_loss_percent: z.number().optional(),
  latency_ms: z.number().int().optional(),
  bitrate_kbps: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

async function gatewayRequest(path: string, payload: unknown) {
  // Future architecture integration point:
  // VIDEO_GATEWAY_URL will point to the dedicated video-gateway service
  // responsible for RTSP/ONVIF ingestion, HLS/WebRTC conversion, stream health
  // checks and secure playback sessions. Until configured, callers receive a
  // pending gateway response and the current Vercel/Supabase runtime is unchanged.
  if (!process.env.VIDEO_GATEWAY_URL) {
    return { gateway_unconfigured: true, path, payload };
  }

  const response = await fetch(`${process.env.VIDEO_GATEWAY_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-secret": process.env.VIDEO_GATEWAY_SIGNING_SECRET ?? ""
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Video gateway error ${response.status}`);
  return response.json();
}

function maskRtspUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "***";
      url.password = "***";
    }
    return url.toString();
  } catch {
    return value.includes("@") ? value.replace(/\/\/[^@]+@/, "//***:***@") : value;
  }
}

function credentialsFromRtspUrl(value: string) {
  try {
    const url = new URL(value);
    return {
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined
    };
  } catch {
    return { username: undefined, password: undefined };
  }
}

function sanitizeCameraRow(camera: Record<string, unknown>) {
  const {
    dvr_host_encrypted,
    username_encrypted,
    password_encrypted,
    encrypted_password,
    connection_username_encrypted,
    connection_password_encrypted,
    ...safeCamera
  } = camera;
  return safeCamera;
}

export async function discoverOnvif(payload: z.infer<typeof onvifDiscoverySchema>) {
  const parsed = onvifDiscoverySchema.parse(payload);
  const gateway = await gatewayRequest("/onvif/discover", parsed);
  return gateway;
}

export async function ingestRtsp(payload: z.infer<typeof rtspIngestSchema>) {
  const parsed = rtspIngestSchema.parse(payload);
  const supabase = createAdminClient();
  const gateway = await gatewayRequest("/streams/rtsp", parsed);
  const gatewayStreamId = (gateway as any).stream_id ?? (gateway as any).id ?? null;
  const urlCredentials = credentialsFromRtspUrl(parsed.rtsp_url);
  const username = parsed.username ?? urlCredentials.username;
  const password = parsed.password ?? urlCredentials.password;
  const maskedSourceUrl = maskRtspUrl(parsed.rtsp_url);

  const { data: camera, error } = await supabase
    .from("camera_streams")
    .upsert({
      id: parsed.camera_stream_id,
      garden_id: parsed.garden_id,
      name: parsed.name,
      area: parsed.area,
      protocol: "RTSP",
      source_type: "RTSP",
      source_url: maskedSourceUrl,
      dvr_host_encrypted: encryptField(parsed.rtsp_url),
      username_encrypted: encryptField(username),
      password_encrypted: encryptField(password),
      stream_status: gatewayStreamId ? "connected" : "pending",
      health_status: gatewayStreamId ? "healthy" : "pending",
      connection_method: process.env.VIDEO_GATEWAY_URL ? "video_gateway" : "pending_gateway",
      video_gateway_stream_id: gatewayStreamId,
      hls_playback_url: (gateway as any).hls_url,
      webrtc_playback_url: (gateway as any).webrtc_url,
      last_seen: gatewayStreamId ? new Date().toISOString() : null,
      last_successful_connection_at: gatewayStreamId ? new Date().toISOString() : null,
      metadata: {
        source_url_masked: true,
        no_rtsp_exposed: true,
        credentials_encrypted: Boolean(username || password)
      },
      active: true
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { camera: sanitizeCameraRow(camera as any), gateway };
}

export async function createDvrConnection(payload: z.infer<typeof dvrConnectionSchema>) {
  const parsed = dvrConnectionSchema.parse(payload);
  const supabase = createAdminClient();
  const gateway = await gatewayRequest("/dvr/connect", parsed);
  const { data, error } = await supabase
    .from("video_gateway_connections")
    .insert({
      garden_id: parsed.garden_id,
      connection_type: parsed.connection_type,
      endpoint_encrypted: encryptField(parsed.endpoint),
      port: parsed.port,
      username_encrypted: encryptField(parsed.username),
      password_encrypted: encryptField(parsed.password),
      gateway_stream_id: (gateway as any).stream_id,
      status: "connected",
      metadata: parsed.metadata
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { connection: data, gateway };
}

export async function recordStreamHealth(payload: z.infer<typeof streamHealthSchema>) {
  const parsed = streamHealthSchema.parse(payload);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("stream_health_checks").insert(parsed as any).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
