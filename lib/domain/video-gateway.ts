import { createHash } from "node:crypto";
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

type GatewayRequestOptions = {
  gatewayUrl?: string;
  gatewaySecret?: string;
};

export const cloudDvrDiscoveryChannelSchema = z.object({
  channel: z.number().int().min(1).max(128),
  name: z.string().trim().min(1).max(120).nullable().optional(),
  area: z.string().trim().min(1).max(120).nullable().optional(),
  stream_id: z.string().trim().min(1).max(160).nullable().optional(),
  gateway_stream_id: z.string().trim().min(1).max(160).nullable().optional(),
  status: z.enum(["connected", "pending", "offline", "failed", "error"]).default("pending"),
  health_status: z.enum(["healthy", "pending", "unknown", "failed", "offline", "error"]).nullable().optional(),
  width: z.number().int().positive().max(10000).nullable().optional(),
  height: z.number().int().positive().max(10000).nullable().optional(),
  candidates_tried: z.number().int().min(0).max(20).optional(),
  template: z.string().trim().max(80).nullable().optional(),
  reason: z.string().trim().max(120).nullable().optional()
}).strict();

export const cloudDvrDiscoverySchema = z.object({
  gateway_id: z.string().trim().min(3).max(120),
  observer_site_id: z.string().uuid().optional(),
  garden_id: z.string().uuid().nullable().optional(),
  connection_type: z.enum(["dvr", "nvr"]).default("dvr"),
  vendor: z.string().trim().max(80).optional(),
  discovery_id: z.string().trim().min(8).max(160),
  discovered_at: z.string().datetime(),
  channel_count: z.number().int().min(1).max(128),
  connected_channel_count: z.number().int().min(0).max(128).optional(),
  failed_channel_count: z.number().int().min(0).max(128).optional(),
  latency_ms: z.number().int().min(0).max(600000).optional(),
  read_only: z.literal(true),
  controls_supported: z.literal(false),
  no_secrets_returned: z.literal(true),
  channels: z.array(cloudDvrDiscoveryChannelSchema).min(1).max(128),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict();

function stableGatewayStreamId(gatewayId: string, gardenId: string, channel: number) {
  const digest = createHash("sha256").update(`${gatewayId}:${gardenId}:${channel}`).digest("hex").slice(0, 24);
  return `dvr_${digest}_${channel}`;
}

function cloudDiscoveryScopeId(input: { gateway_id: string; garden_id?: string | null; observer_site_id?: string | null }) {
  return input.garden_id || input.observer_site_id || input.gateway_id;
}

export function isVideoGatewayConfigured(): boolean;
export function isVideoGatewayConfigured(options: GatewayRequestOptions): boolean;
export function isVideoGatewayConfigured(options: GatewayRequestOptions = {}) {
  return Boolean(gatewayBaseUrl(options) && gatewaySecret(options));
}

async function gatewayRequest(path: string, payload: unknown, options: GatewayRequestOptions = {}) {
  // Future architecture integration point:
  // VIDEO_GATEWAY_URL will point to the dedicated video-gateway service
  // responsible for RTSP/ONVIF ingestion, HLS/WebRTC conversion, stream health
  // checks and secure playback sessions. Until configured, callers receive a
  // pending gateway response and the current Vercel/Supabase runtime is unchanged.
  if (!isVideoGatewayConfigured(options)) {
    return { gateway_unconfigured: true, path, status: "pending_gateway" };
  }

  const response = await fetch(`${gatewayBaseUrl(options)}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-secret": gatewaySecret(options)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Video gateway error ${response.status}`);
  return response.json();
}

function gatewayBaseUrl(options: GatewayRequestOptions = {}) {
  return options.gatewayUrl ?? process.env.VIDEO_GATEWAY_URL ?? process.env.CAMERA_GATEWAY_URL ?? "";
}

function gatewaySecret(options: GatewayRequestOptions = {}) {
  return options.gatewaySecret ?? process.env.VIDEO_GATEWAY_SIGNING_SECRET ?? process.env.VIDEO_GATEWAY_API_KEY ?? process.env.CAMERA_GATEWAY_SECRET ?? "";
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
    secret_ref,
    source_secret_reference,
    connection_username_encrypted,
    connection_password_encrypted,
    host,
    connection_host,
    source_url,
    rtsp_template,
    hls_playback_url,
    sample_hls_url,
    webrtc_playback_url,
    ...safeCamera
  } = camera;
  return safeCamera;
}

function sanitizeGatewayResult(gateway: Record<string, unknown>) {
  return {
    configured: !gateway.gateway_unconfigured,
    status: gateway.status ?? (gateway.gateway_unconfigured ? "pending_gateway" : "connected"),
    stream_id: gateway.stream_id ?? gateway.id ?? null,
    message: gateway.message ?? null,
    candidate_count: Array.isArray(gateway.candidates) ? gateway.candidates.length : undefined
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.trunc(Number(value));
  }
  return null;
}

function gatewayChannels(gateway: Record<string, unknown>, metadata: Record<string, unknown>) {
  const channelSources = [
    gateway.channels,
    gateway.camera_channels,
    gateway.cameras,
    gateway.streams,
    asObject(gateway.data).channels,
    asObject(gateway.data).camera_channels,
    asObject(gateway.data).cameras,
    asObject(gateway.data).streams,
    metadata.channels,
    metadata.camera_channels
  ];
  const rawChannels = channelSources.find(Array.isArray) as unknown[] | undefined;
  if (rawChannels?.length) {
    return rawChannels.map((raw, index) => {
      const item = asObject(raw);
      const channel = firstNumber(item.channel, item.channel_number, item.channelNumber, item.index, item.id) ?? index + 1;
      return {
        channel,
        name: firstString(item.name, item.display_name, item.label, item.title) ?? `ערוץ ${channel}`,
        area: firstString(item.area, item.location, item.location_label) ?? `ערוץ ${channel}`,
        streamId: firstString(item.stream_id, item.gateway_stream_id, item.id, item.path),
        hlsUrl: firstString(item.hls_url, item.hls, item.playback_hls_url),
        webrtcUrl: firstString(item.webrtc_url, item.webrtc, item.playback_webrtc_url),
        status: firstString(item.status, item.health_status)
      };
    });
  }

  const channelCount = firstNumber(gateway.channel_count, gateway.channels_count, asObject(gateway.data).channel_count, metadata.channel_count, metadata.channels_count) ?? 0;
  const gatewayStreamId = firstString(gateway.stream_id, gateway.id);
  const count = channelCount > 0 ? Math.min(channelCount, 128) : gatewayStreamId ? 1 : 0;
  return Array.from({ length: count }, (_, index) => {
    const channel = index + 1;
    return {
      channel,
      name: `DVR ערוץ ${channel}`,
      area: `ערוץ ${channel}`,
      streamId: gatewayStreamId ? (count === 1 ? gatewayStreamId : `${gatewayStreamId}_${channel}`) : null,
      hlsUrl: firstString(gateway.hls_url),
      webrtcUrl: firstString(gateway.webrtc_url),
      status: gatewayStreamId ? "connected" : "pending"
    };
  });
}

async function observerSiteIdForGarden(supabase: ReturnType<typeof createAdminClient>, gardenId: string) {
  const { data } = await supabase
    .from("observer_sites" as any)
    .select("id")
    .eq("garden_id", gardenId)
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

async function upsertDigitalObserverCameraSource(
  supabase: ReturnType<typeof createAdminClient>,
  values: {
    observerSiteId: string | null;
    cameraStreamId: string | null;
    connectionId: string | null;
    channel: number;
    displayName: string;
    area: string;
    connectorType: "dvr" | "nvr" | "onvif" | "rtsp";
    gatewayStreamId: string | null;
    gatewayConfigured: boolean;
    connected: boolean;
    statusHint: string | null;
    edgeCapabilityContract?: Record<string, unknown> | null;
    localEventInsightsEnabled: boolean;
    edgePolicy: Record<string, unknown>;
  }
) {
  if (!values.observerSiteId) return null;
  const existing = values.cameraStreamId
    ? await supabase
      .from("digital_observer_camera_sources" as any)
      .select("id,metadata")
      .eq("camera_stream_id", values.cameraStreamId)
      .maybeSingle()
    : values.gatewayStreamId
      ? await supabase
        .from("digital_observer_camera_sources" as any)
        .select("id,metadata")
        .eq("observer_site_id", values.observerSiteId)
        .contains("metadata", { gateway_stream_id: values.gatewayStreamId })
        .maybeSingle()
      : { data: null };
  const now = new Date().toISOString();
  const unavailable = ["offline", "failed", "error"].includes(String(values.statusHint ?? "").toLowerCase());
  const sourceMode = values.connected ? "gateway_test" : "readiness";
  const sourceStatus = values.connected ? "connected" : unavailable ? "offline" : "ready_to_test";
  const healthStatus = values.connected ? "healthy" : unavailable ? "failed" : "unknown";
  const payload = {
    observer_site_id: values.observerSiteId,
    camera_stream_id: values.cameraStreamId,
    display_name: values.displayName,
    location_label: values.area,
    connector_type: values.connectorType,
    connector_provider: "video_gateway",
    source_mode: sourceMode,
    status: sourceStatus,
    health_status: healthStatus,
    stream_protocol: "rtsp_tcp",
    gateway_provider: process.env.VIDEO_GATEWAY_PROVIDER ?? process.env.CAMERA_PROVIDER ?? "custom",
    capabilities: {
      preview: values.connected,
      live_view: values.connected,
      event_clips: values.connected,
      local_event_insights: values.localEventInsightsEnabled,
      local_activity_sampling: values.connected,
      credentials_saved: true,
      gateway_required: !values.connected,
      connector_transport: "gateway"
    },
    monitoring_targets: ["person", "entry_exit", "camera_obstruction", "after_hours"],
    last_health_check_at: now,
    last_seen_at: values.connected ? now : null,
    last_error_code: values.connected ? null : unavailable ? "DVR_CHANNEL_OFFLINE" : "GATEWAY_CHANNELS_PENDING",
    last_error_message: values.connected ? null : unavailable ? "ערוץ ה-DVR לא החזיר וידאו בבדיקת הקריאה האחרונה." : "חיבור DVR נשמר; ערוץ ממתין לאישור Gateway.",
    secret_reference: values.connectionId ? `video_gateway_connections:${values.connectionId}` : null,
    metadata: {
      product: "digital_observer",
      source: "dvr_connection",
      video_gateway_connection_id: values.connectionId,
      dvr_channel: values.channel,
      gateway_stream_id: values.gatewayStreamId,
      gateway_stream_id_present: Boolean(values.gatewayStreamId),
      gateway_configured: values.gatewayConfigured,
      status_hint: values.statusHint,
      no_rtsp_exposed: true,
      credentials_server_side: true,
      edge_inference_policy: "local-insights-v1",
      edge_capability_contract: values.edgeCapabilityContract ?? null,
      edge_policy: values.edgePolicy
    }
  };
  if ((existing as any)?.data?.id) {
    const { data, error } = await supabase
      .from("digital_observer_camera_sources" as any)
      .update({ ...payload, updated_at: now })
      .eq("id", (existing as any).data.id)
      .select("id,observer_site_id,camera_stream_id,display_name,status,health_status,source_mode")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase
    .from("digital_observer_camera_sources" as any)
    .insert(payload as any)
    .select("id,observer_site_id,camera_stream_id,display_name,status,health_status,source_mode")
    .single();
  if (error) throw new Error(error.message);
  return data;
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
      connection_method: isVideoGatewayConfigured() ? "video_gateway" : "pending_gateway",
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
  return { camera: sanitizeCameraRow(camera as any), gateway: sanitizeGatewayResult(gateway) };
}

export async function createDvrConnection(payload: z.infer<typeof dvrConnectionSchema>, options: GatewayRequestOptions = {}) {
  const parsed = dvrConnectionSchema.parse(payload);
  const supabase = createAdminClient();
  const gatewayConfigured = isVideoGatewayConfigured(options);
  const gateway = await gatewayRequest("/dvr/connect", parsed, options);
  const gatewayStreamId = (gateway as any).stream_id ?? (gateway as any).id ?? null;
  const channels = gatewayChannels(gateway as Record<string, unknown>, parsed.metadata);
  const hasConnectedChannel = channels.some((channel) => {
    const status = String(channel.status ?? "").toLowerCase();
    return Boolean(channel.streamId) && !["offline", "failed", "error"].includes(status);
  });
  const connectionStatus = gatewayStreamId || hasConnectedChannel ? "connected" : "pending_gateway";
  const { data, error } = await supabase
    .from("video_gateway_connections")
    .insert({
      garden_id: parsed.garden_id,
      connection_type: parsed.connection_type,
      endpoint_encrypted: encryptField(parsed.endpoint),
      port: parsed.port,
      username_encrypted: encryptField(parsed.username),
      password_encrypted: encryptField(parsed.password),
      gateway_stream_id: gatewayStreamId,
      status: connectionStatus,
      metadata: {
        ...parsed.metadata,
        gateway_configured: gatewayConfigured,
        channel_count: channels.length,
        live_connection_verified: connectionStatus === "connected",
        no_secrets_exposed: true
      }
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const connectionId = (data as any)?.id ?? null;
  const observerSiteId = await observerSiteIdForGarden(supabase, parsed.garden_id);
  const now = new Date().toISOString();
  const channelResults = [];

  for (const channel of channels) {
    const channelStreamId = channel.streamId ?? (gatewayStreamId ? `${gatewayStreamId}_${channel.channel}` : null);
    const channelStatus = String(channel.status ?? "pending").toLowerCase();
    const connected = Boolean(channelStreamId && channelStatus === "connected");
    const unavailable = ["offline", "failed", "error"].includes(channelStatus);
    const cameraPayload = {
      garden_id: parsed.garden_id,
      observer_site_id: observerSiteId,
      name: channel.name,
      area: channel.area,
      camera_type: parsed.connection_type.toUpperCase(),
      source_type: parsed.connection_type.toUpperCase(),
      source_category: parsed.connection_type === "rtsp" ? "rtsp_direct" : parsed.connection_type === "onvif" ? "onvif" : "dvr_nvr",
      system_type: parsed.connection_type,
      protocol: "RTSP",
      status: connected ? "connected" : unavailable ? "offline" : "pending_gateway",
      stream_status: connected ? "connected" : unavailable ? "offline" : "pending",
      health_status: connected ? "healthy" : unavailable ? "offline" : "pending",
      active: true,
      dvr_host_encrypted: encryptField(parsed.endpoint),
      dvr_port: parsed.port,
      username_encrypted: encryptField(parsed.username),
      password_encrypted: encryptField(parsed.password),
      channel: String(channel.channel),
      connection_channel: channel.channel,
      connection_port: parsed.port,
      connection_method: gatewayConfigured ? "video_gateway" : "pending_gateway",
      gateway_registration_status: connected ? "registered" : unavailable ? "offline" : "pending_gateway",
      gateway_stream_id: channelStreamId,
      video_gateway_stream_id: channelStreamId,
      hls_playback_url: channel.hlsUrl,
      webrtc_playback_url: channel.webrtcUrl,
      playback_hls_ready: Boolean(channel.hlsUrl || channelStreamId),
      playback_webrtc_ready: Boolean(channel.webrtcUrl || channelStreamId),
      live_preview_status: connected ? "ready" : unavailable ? "offline" : "pending_gateway",
      observer_enabled: true,
      observer_shadow_mode: true,
      observer_review_required: true,
      parent_view_allowed: false,
      parent_viewing_allowed: false,
      parent_visibility_status: "blocked",
      parent_blocked_reason: "digital_observer_dvr_source_server_side_only",
      last_seen: connected ? now : null,
      last_successful_connection_at: connected ? now : null,
      last_health_check_at: now,
      last_test_status: connected ? "healthy" : "pending_gateway",
      last_test_message: connected ? "חיבור DVR אומת דרך Gateway" : "חיבור DVR נשמר וממתין לערוצי Gateway",
      last_test_at: now,
      metadata: {
        dvr_connection_id: connectionId,
        dvr_channel: channel.channel,
        no_rtsp_exposed: true,
        credentials_encrypted: Boolean(parsed.username || parsed.password),
        source: "dvr_connection"
      }
    };
    const existingCamera = channelStreamId
      ? await supabase
        .from("camera_streams" as any)
        .select("id")
        .eq("garden_id", parsed.garden_id)
        .eq("video_gateway_stream_id", channelStreamId)
        .maybeSingle()
      : { data: null };
    const cameraWrite = (existingCamera as any).data?.id
      ? await supabase
        .from("camera_streams" as any)
        .update(cameraPayload as any)
        .eq("id", (existingCamera as any).data.id)
        .select("*")
        .single()
      : await supabase
        .from("camera_streams" as any)
        .insert(cameraPayload as any)
        .select("*")
        .single();
    const { data: camera, error: cameraError } = cameraWrite;
    if (cameraError) throw new Error(cameraError.message);
    const observerSource = await upsertDigitalObserverCameraSource(supabase, {
      observerSiteId,
      cameraStreamId: (camera as any).id,
      connectionId,
      channel: channel.channel,
      displayName: channel.name,
      area: channel.area,
      connectorType: parsed.connection_type,
      gatewayStreamId: channelStreamId,
      gatewayConfigured,
      connected,
      statusHint: channel.status,
      edgeCapabilityContract: null,
      localEventInsightsEnabled: false,
      edgePolicy: {
        version: "local-insights-v1",
        monitoring_consent_verified: false,
        object_detection_enabled: false,
        biometric_recognition_enabled: false,
        biometric_matching_enabled: false,
        reason: "gateway_edge_contract_not_supplied"
      }
    });
    channelResults.push({ camera: sanitizeCameraRow(camera as any), observer_source: observerSource });
  }

  if (connectionId && channelResults[0]?.camera?.id) {
    await supabase
      .from("video_gateway_connections" as any)
      .update({
        camera_stream_id: channelResults[0].camera.id,
        last_discovery_at: now,
        last_ingest_at: now,
        metadata: {
          ...((data as any)?.metadata ?? {}),
          channel_count: channelResults.length,
          observer_site_id: observerSiteId,
          channels_materialized: channelResults.length > 0,
          no_secrets_exposed: true
        }
      } as any)
      .eq("id", connectionId);
  }

  return {
    connection: {
      id: connectionId,
      garden_id: (data as any)?.garden_id ?? parsed.garden_id,
      connection_type: (data as any)?.connection_type ?? parsed.connection_type,
      gateway_stream_id: (data as any)?.gateway_stream_id ?? null,
      status: (data as any)?.status ?? connectionStatus,
      created_at: (data as any)?.created_at ?? null,
      updated_at: (data as any)?.updated_at ?? null
    },
    gateway: sanitizeGatewayResult(gateway),
    channels: channelResults
  };
}

export async function materializeCloudDvrDiscovery(payload: z.infer<typeof cloudDvrDiscoverySchema>) {
  const parsed = cloudDvrDiscoverySchema.parse(payload);
  const supabase = createAdminClient();
  const observerSiteId = parsed.observer_site_id ?? (parsed.garden_id ? await observerSiteIdForGarden(supabase, parsed.garden_id) : null);
  const now = new Date().toISOString();
  const connectedCount = parsed.channels.filter((channel) => channel.status === "connected").length;
  const scopeId = cloudDiscoveryScopeId(parsed);
  const connectionId = null;
  const results = [];
  const siteConsent = observerSiteId
    ? await supabase
      .from("observer_sites" as any)
      .select("monitoring_enabled,vision_privacy_mode,business_handles_children,metadata")
      .eq("id", observerSiteId)
      .maybeSingle()
    : { data: null };
  const siteMetadata = siteConsent.data?.metadata && typeof siteConsent.data.metadata === "object" ? siteConsent.data.metadata as Record<string, unknown> : {};
  const monitoringConsentVerified = siteConsent.data?.monitoring_enabled === true
    && siteMetadata.observer_monitoring_consent === true
    && siteConsent.data?.vision_privacy_mode !== "skeleton_only"
    && siteConsent.data?.business_handles_children !== true;
  const edgeCapabilityContract = parsed.metadata?.edge_capability_contract && typeof parsed.metadata.edge_capability_contract === "object"
    ? parsed.metadata.edge_capability_contract as Record<string, any>
    : null;
  const verifiedObjectInference = edgeCapabilityContract?.gateway?.connected === true
    && edgeCapabilityContract?.runtime?.available === true
    && edgeCapabilityContract?.models?.loaded === true
    && edgeCapabilityContract?.capability_test?.passed === true
    && edgeCapabilityContract?.capabilities?.object_detection === true;
  const localEventInsightsEnabled = Boolean(monitoringConsentVerified && verifiedObjectInference);
  const edgePolicy = {
    version: "local-insights-v1",
    evaluated_at: now,
    monitoring_consent_verified: monitoringConsentVerified,
    object_detection_enabled: localEventInsightsEnabled,
    biometric_recognition_enabled: false,
    biometric_matching_enabled: false,
    reason: localEventInsightsEnabled
      ? "verified_gateway_contract_and_site_monitoring_consent"
      : monitoringConsentVerified
        ? "gateway_edge_contract_not_ready"
        : "site_monitoring_consent_required"
  };

  for (const channel of parsed.channels) {
    const gatewayStreamId = channel.gateway_stream_id ?? channel.stream_id ?? stableGatewayStreamId(parsed.gateway_id, scopeId, channel.channel);
    const connected = channel.status === "connected";
    const name = channel.name ?? `DVR ערוץ ${channel.channel}`;
    const area = channel.area ?? `ערוץ ${channel.channel}`;
    const cameraPayload = {
      garden_id: parsed.garden_id ?? null,
      observer_site_id: observerSiteId,
      name,
      area,
      camera_type: parsed.connection_type.toUpperCase(),
      source_type: parsed.connection_type.toUpperCase(),
      source_category: "dvr_nvr",
      system_type: parsed.connection_type,
      protocol: "RTSP",
      status: connected ? "connected" : "offline",
      stream_status: connected ? "connected" : "offline",
      health_status: connected ? "healthy" : "offline",
      active: true,
      dvr_host_encrypted: null,
      dvr_port: null,
      username_encrypted: null,
      password_encrypted: null,
      channel: String(channel.channel),
      connection_channel: channel.channel,
      connection_port: null,
      connection_method: "cloud_video_gateway",
      gateway_provider: "custom",
      gateway_registration_status: connected ? "registered" : "offline",
      gateway_stream_id: gatewayStreamId,
      video_gateway_stream_id: gatewayStreamId,
      hls_playback_url: null,
      webrtc_playback_url: null,
      playback_hls_ready: false,
      playback_webrtc_ready: false,
      live_preview_status: connected ? "ready" : "offline",
      observer_enabled: true,
      observer_shadow_mode: true,
      observer_review_required: true,
      parent_view_allowed: false,
      parent_viewing_allowed: false,
      parent_visibility_status: "blocked",
      parent_blocked_reason: "digital_observer_cloud_dvr_shadow_only",
      last_seen: connected ? now : null,
      last_successful_connection_at: connected ? now : null,
      last_health_check_at: now,
      last_test_status: connected ? "healthy" : "failed",
      last_test_message: connected ? "חיבור DVR אומת דרך Gateway מקומי מסונן" : "ערוץ DVR דווח כ-Offline לאחר בדיקת קריאה",
      last_test_at: now,
      gateway_latency_ms: parsed.latency_ms ?? null,
      gateway_failed_stream_count: parsed.failed_channel_count ?? null,
      metadata: {
        source: "cloud_dvr_discovery",
        gateway_id: parsed.gateway_id,
        discovery_id: parsed.discovery_id,
        dvr_channel: channel.channel,
        vendor: parsed.vendor ?? null,
        template: channel.template ?? null,
        width: channel.width ?? null,
        height: channel.height ?? null,
        candidates_tried: channel.candidates_tried ?? null,
        reason: channel.reason ?? null,
        no_rtsp_exposed: true,
        no_credentials_received: true,
        ai_shadow_only: true,
        local_event_insights: localEventInsightsEnabled,
        local_activity_sampling: connected,
        edge_capability_contract: edgeCapabilityContract,
        edge_policy: edgePolicy,
        raw_frames_uploaded: false,
        read_only: true
      }
    };
    const existingCameraQuery = supabase
      .from("camera_streams" as any)
      .select("id")
      .eq("video_gateway_stream_id", gatewayStreamId);
    const existingCamera = parsed.garden_id
      ? await existingCameraQuery.eq("garden_id", parsed.garden_id).maybeSingle()
      : await existingCameraQuery.eq("observer_site_id", observerSiteId).maybeSingle();
    const cameraWrite = (existingCamera as any).data?.id
      ? await supabase
        .from("camera_streams" as any)
        .update(cameraPayload as any)
        .eq("id", (existingCamera as any).data.id)
        .select("*")
        .single()
      : await supabase
        .from("camera_streams" as any)
        .insert(cameraPayload as any)
        .select("*")
        .single();
    const { data: camera, error: cameraError } = cameraWrite;
    if (cameraError && parsed.garden_id) throw new Error(cameraError.message);
    if (cameraError && !parsed.garden_id) {
      console.warn("[video-gateway] camera_streams observer-only insert unavailable; materializing Digital Observer source only", { code: cameraError.code });
    }
    const observerSource = await upsertDigitalObserverCameraSource(supabase, {
      observerSiteId,
      cameraStreamId: (camera as any)?.id ?? null,
      connectionId,
      channel: channel.channel,
      displayName: name,
      area,
      connectorType: parsed.connection_type,
      gatewayStreamId,
      gatewayConfigured: true,
      connected,
      statusHint: channel.status,
      edgeCapabilityContract,
      localEventInsightsEnabled,
      edgePolicy
    });
    results.push({ camera: camera ? sanitizeCameraRow(camera as any) : null, observer_source: observerSource, gateway_stream_id: gatewayStreamId });
  }

  if (observerSiteId && connectedCount > 0) {
    const consent = await supabase.from("observer_sites" as any).select("monitoring_enabled,metadata").eq("id", observerSiteId).maybeSingle();
    const metadata = consent.data?.metadata && typeof consent.data.metadata === "object" ? consent.data.metadata : {};
    if (consent.data?.monitoring_enabled === true && metadata.observer_monitoring_consent === true) {
      const learning = await supabase.rpc("initialize_digital_observer_learning" as any, { requested_site_id: observerSiteId });
      if (learning.error) console.warn("[video-gateway] observer learning initialization unavailable", { code: learning.error.code });
    }
  }

  return {
    connection_id: connectionId,
    observer_site_id: observerSiteId,
    channel_count: results.length,
    connected_channel_count: connectedCount,
    channels: results
  };
}

export async function recordStreamHealth(payload: z.infer<typeof streamHealthSchema>) {
  const parsed = streamHealthSchema.parse(payload);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("stream_health_checks").insert(parsed as any).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
