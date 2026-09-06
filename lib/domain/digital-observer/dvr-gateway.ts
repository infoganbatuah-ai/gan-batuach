import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { checkGatewayHealth, getPlaybackUrls, isGatewayConfigured } from "@/lib/domain/video-gateway-client";
import { assessCameraConnection } from "@/lib/domain/digital-observer/camera-connection-layer";

const protocolSchema = z.enum(["onvif", "rtsp", "manufacturer_api"]);
const manufacturerSchema = z.enum(["hikvision", "dahua", "uniview", "axis", "generic"]);

const channelSchema = z.object({
  channel: z.coerce.number().int().min(1).max(64),
  display_name: z.string().trim().min(1).max(120).optional(),
  location_label: z.string().trim().max(120).optional(),
  enabled: z.boolean().optional().default(true),
  stream_quality: z.enum(["main", "sub"]).optional().default("sub"),
  event_ingest_enabled: z.boolean().optional().default(true)
});

export const localDvrGatewayConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  recorder: z.object({
    id: z.string().trim().min(1).max(80).default("local-dvr"),
    display_name: z.string().trim().min(1).max(120).default("Local DVR"),
    manufacturer: manufacturerSchema.default("generic"),
    model: z.string().trim().max(120).optional(),
    firmware_family: z.string().trim().max(120).optional(),
    channel_count: z.coerce.number().int().min(1).max(64).default(16),
    preferred_protocol: protocolSchema.optional(),
    supported_protocols: z.array(protocolSchema).optional().default([]),
    gateway_stream_prefix: z.string().trim().min(1).max(80).optional()
  }),
  capabilities: z.object({
    live: z.boolean().optional().default(true),
    playback: z.boolean().optional().default(true),
    events: z.boolean().optional().default(true),
    audio: z.boolean().optional().default(false),
    ptz: z.boolean().optional().default(false),
    siren: z.boolean().optional().default(false),
    light: z.boolean().optional().default(false),
    remote_settings: z.boolean().optional().default(false)
  }).optional().default({
    live: true,
    playback: true,
    events: true,
    audio: false,
    ptz: false,
    siren: false,
    light: false,
    remote_settings: false
  }),
  onvif: z.object({
    enabled: z.boolean().optional().default(false)
  }).optional().default({ enabled: false }),
  rtsp: z.object({
    enabled: z.boolean().optional().default(false),
    templates: z.array(z.string().trim().min(1)).optional().default([])
  }).optional().default({ enabled: false, templates: [] }),
  manufacturer_api: z.object({
    enabled: z.boolean().optional().default(false),
    provider: manufacturerSchema.optional()
  }).optional().default({ enabled: false }),
  channels: z.array(channelSchema).optional().default([])
});

export type LocalDvrGatewayConfig = z.infer<typeof localDvrGatewayConfigSchema>;
export type DvrGatewayProtocol = z.infer<typeof protocolSchema>;

export type DvrGatewayEventRow = {
  id: string;
  camera_id?: string | null;
  camera_source_id?: string | null;
  signal_type?: string | null;
  severity?: string | null;
  confidence?: number | null;
  review_status?: string | null;
  recommended_action?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  resolved_at?: string | null;
};

const defaultConfig: LocalDvrGatewayConfig = localDvrGatewayConfigSchema.parse({
  enabled: false,
  recorder: {
    id: "local-dvr",
    display_name: "Local DVR",
    manufacturer: "generic",
    channel_count: 16
  }
});

function parseConfig(raw: string | undefined) {
  if (!raw?.trim()) return defaultConfig;
  return localDvrGatewayConfigSchema.parse(JSON.parse(raw));
}

export function loadLocalDvrGatewayConfig() {
  const inlineConfig = process.env.DIGITAL_OBSERVER_DVR_CONFIG_JSON;
  if (inlineConfig?.trim()) return parseConfig(inlineConfig);

  const configPath = process.env.DIGITAL_OBSERVER_DVR_CONFIG_PATH;
  if (configPath?.trim() && existsSync(configPath)) {
    return parseConfig(readFileSync(configPath, "utf8"));
  }

  return defaultConfig;
}

export function identifySupportedDvrConnection(config = loadLocalDvrGatewayConfig()) {
  const configuredProtocols = new Set<DvrGatewayProtocol>(config.recorder.supported_protocols);
  if (config.onvif.enabled) configuredProtocols.add("onvif");
  if (config.rtsp.enabled || config.rtsp.templates.length > 0) configuredProtocols.add("rtsp");
  if (config.manufacturer_api.enabled) configuredProtocols.add("manufacturer_api");

  const preferred = config.recorder.preferred_protocol && configuredProtocols.has(config.recorder.preferred_protocol)
    ? config.recorder.preferred_protocol
    : configuredProtocols.has("onvif")
      ? "onvif"
      : configuredProtocols.has("rtsp")
        ? "rtsp"
        : configuredProtocols.has("manufacturer_api")
          ? "manufacturer_api"
          : null;

  return {
    supported: Boolean(config.enabled && preferred),
    preferred_protocol: preferred,
    supported_protocols: Array.from(configuredProtocols),
    manufacturer: config.recorder.manufacturer,
    model_configured: Boolean(config.recorder.model),
    local_endpoint_configured: config.enabled,
    read_only: true
  };
}

function streamIdFor(config: LocalDvrGatewayConfig, channel: number) {
  const prefix = config.recorder.gateway_stream_prefix ?? config.recorder.id;
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 80) || "local_dvr";
  return `${safePrefix}_ch${String(channel).padStart(2, "0")}`;
}

function channelRows(config: LocalDvrGatewayConfig) {
  const configured = new Map(config.channels.map((channel) => [channel.channel, channel]));
  return Array.from({ length: config.recorder.channel_count }, (_, index) => {
    const channelNumber = index + 1;
    const row = configured.get(channelNumber) ?? channelSchema.parse({ channel: channelNumber });
    return { ...row, channel: channelNumber };
  });
}

export function buildDvrDashboardContract(params: {
  observerSiteId: string;
  config?: LocalDvrGatewayConfig;
  events?: DvrGatewayEventRow[];
}) {
  const config = params.config ?? loadLocalDvrGatewayConfig();
  const connection = identifySupportedDvrConnection(config);
  const gatewayConfigured = isGatewayConfigured();
  const canonicalAssessment = assessCameraConnection({
    siteId: params.observerSiteId,
    connectorType: "dvr",
    provider: config.recorder.manufacturer,
    onvifAvailable: connection.supported_protocols.includes("onvif"),
    onvifReachable: false,
    rtspAvailable: connection.supported_protocols.includes("rtsp"),
    rtspReachable: false,
    privateNetworkOnly: true,
    softwareConnectorAvailable: false,
    physicalGatewayAvailable: gatewayConfigured,
    physicalGatewayEnrolled: gatewayConfigured,
    physicalGatewayOutboundOnly: true,
    legacySystem: true,
    credentialReferenceConfigured: gatewayConfigured,
    endpointReferenceConfigured: gatewayConfigured,
    discoveredCapabilities: [
      ...(config.capabilities.live ? ["LIVE_STREAM" as const] : []),
      "CHANNEL_DISCOVERY" as const,
      ...(config.capabilities.playback ? ["RECORDING_ACCESS" as const] : []),
      "HEALTH" as const,
      ...(config.capabilities.ptz ? ["PTZ" as const] : [])
    ]
  });
  const readOnlyDisabled = {
    ptz: false,
    siren: false,
    light: false,
    remote_settings: false,
    dvr_mutation: false
  };

  return {
    observer_site_id: params.observerSiteId,
    recorder: {
      id: config.recorder.id,
      display_name: config.recorder.display_name,
      manufacturer: config.recorder.manufacturer,
      model_configured: Boolean(config.recorder.model),
      firmware_family_configured: Boolean(config.recorder.firmware_family),
      channel_count: config.recorder.channel_count
    },
    connection: {
      ...connection,
      canonical_contract_version: canonicalAssessment.contractVersion,
      canonical_method: canonicalAssessment.preferredMethod,
      canonical_adapter: canonicalAssessment.adapterType,
      canonical_adapter_version: canonicalAssessment.adapterVersion,
      recommendation: canonicalAssessment.recommendation,
      recommendation_reasons: canonicalAssessment.reasonCodes,
      automatic_fallback_enabled: false,
      gateway_configured: gatewayConfigured,
      status: !config.enabled
        ? "local_config_required"
        : !connection.supported
          ? "unsupported_or_incomplete_config"
          : gatewayConfigured
            ? "ready"
            : "gateway_config_required"
    },
    policy: {
      server_side_only: true,
      no_browser_credentials: true,
      no_private_addresses: true,
      no_secret_logging: true,
      read_only: true,
      disabled_actions: readOnlyDisabled
    },
    cameras: channelRows(config).map((channel) => {
      const gatewayStreamId = streamIdFor(config, channel.channel);
      const liveAvailable = Boolean(config.enabled && channel.enabled && config.capabilities.live && connection.supported && gatewayConfigured);
      const playbackAvailable = Boolean(config.enabled && channel.enabled && config.capabilities.playback && connection.supported && gatewayConfigured);
      return {
        id: `${config.recorder.id}:channel:${channel.channel}`,
        channel: channel.channel,
        display_name: channel.display_name ?? `Camera ${channel.channel}`,
        location_label: channel.location_label ?? null,
        enabled: channel.enabled,
        connection_status: liveAvailable ? "ready" : config.enabled ? "pending_gateway" : "not_configured",
        gateway_stream_id: gatewayStreamId,
        stream_quality: channel.stream_quality,
        live: {
          available: liveAvailable,
          protocol: connection.preferred_protocol,
          session_endpoint: `/api/digital-observer/dvr-gateway?action=live&channel=${channel.channel}`
        },
        playback: {
          available: playbackAvailable,
          protocol: connection.preferred_protocol,
          session_endpoint: `/api/digital-observer/dvr-gateway?action=playback&channel=${channel.channel}`
        },
        events: {
          enabled: Boolean(channel.event_ingest_enabled && config.capabilities.events)
        }
      };
    }),
    events: (params.events ?? []).map((event) => ({
      id: event.id,
      camera_id: event.camera_id ?? event.camera_source_id ?? null,
      signal_type: event.signal_type ?? null,
      severity: event.severity ?? null,
      confidence: event.confidence ?? null,
      review_status: event.review_status ?? null,
      recommended_action: event.recommended_action ?? null,
      created_at: event.created_at ?? null,
      reviewed_at: event.reviewed_at ?? null,
      resolved_at: event.resolved_at ?? null
    }))
  };
}

export async function buildDvrGatewayStatus(observerSiteId: string, events: DvrGatewayEventRow[] = []) {
  const contract = buildDvrDashboardContract({ observerSiteId, events });
  const gateway = await checkGatewayHealth();
  return {
    ...contract,
    gateway: {
      configured: gateway.configured,
      status: gateway.status,
      provider: gateway.provider ?? null,
      latency_ms: gateway.latencyMs ?? null,
      stream_count: gateway.streamCount ?? null,
      failed_stream_count: gateway.failedStreamCount ?? null
    }
  };
}

export async function createDvrPlaybackSession(params: {
  observerSiteId: string;
  channel: number;
  mode: "live" | "playback";
  token?: string;
}) {
  const config = loadLocalDvrGatewayConfig();
  const contract = buildDvrDashboardContract({ observerSiteId: params.observerSiteId, config });
  const camera = contract.cameras.find((item) => item.channel === params.channel);
  if (!camera || !camera.enabled) throw new Error("Camera channel is not available");
  const capability = params.mode === "live" ? camera.live : camera.playback;
  if (!capability.available) throw new Error("Secure gateway playback is not available");

  const gateway = await getPlaybackUrls(camera.gateway_stream_id, params.token);
  return {
    camera_id: camera.id,
    channel: camera.channel,
    mode: params.mode,
    gateway_stream_id: camera.gateway_stream_id,
    provider: gateway.provider ?? null,
    status: gateway.status,
    playback: gateway.playback,
    expires_in_seconds: 300,
    private_source_hidden: true
  };
}
