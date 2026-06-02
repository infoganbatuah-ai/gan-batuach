import { buildRtspCandidates, type CameraConnectionInput } from "@/lib/domain/camera-connection-builder";

export type VideoGatewayProvider = "mediamtx" | "go2rtc" | "custom";

export type GatewayResult = {
  configured: boolean;
  status: "healthy" | "gateway_required" | "error";
  message: string;
  provider?: VideoGatewayProvider | null;
  data?: Record<string, unknown> | null;
  latencyMs?: number | null;
  streamCount?: number | null;
  failedStreamCount?: number | null;
};

export function getGatewayProvider(): VideoGatewayProvider {
  const provider = process.env.VIDEO_GATEWAY_PROVIDER;
  if (provider === "mediamtx" || provider === "go2rtc") return provider;
  return "custom";
}

export function isGatewayConfigured() {
  return Boolean(process.env.VIDEO_GATEWAY_URL && (process.env.VIDEO_GATEWAY_API_KEY || process.env.VIDEO_GATEWAY_SIGNING_SECRET));
}

function providerPath(provider: VideoGatewayProvider, action: "health" | "test" | "register" | "playback" | "disable", value?: string) {
  if (provider === "mediamtx") {
    if (action === "health") return "/v3/config/global/get";
    if (action === "playback") return `/v3/paths/get/${encodeURIComponent(value ?? "")}`;
    if (action === "disable") return `/v3/config/paths/delete/${encodeURIComponent(value ?? "")}`;
    return "/v3/config/paths/add";
  }
  if (provider === "go2rtc") {
    if (action === "health") return "/api/streams";
    if (action === "playback") return `/api/streams?src=${encodeURIComponent(value ?? "")}`;
    if (action === "disable") return `/api/streams?src=${encodeURIComponent(value ?? "")}`;
    return "/api/streams";
  }
  if (action === "health") return "/health";
  if (action === "test") return "/camera/test";
  if (action === "register") return "/camera/register";
  if (action === "playback") return `/camera/${encodeURIComponent(value ?? "")}/playback`;
  return `/camera/${encodeURIComponent(value ?? "")}/disable`;
}

type RtspCandidate = { url: string; vendor?: string; template?: string };

function providerPayload(provider: VideoGatewayProvider, action: "test" | "register" | "disable", cameraId?: string, candidates: RtspCandidate[] = []) {
  if (provider === "mediamtx") {
    const source = candidates[0]?.url;
    return action === "disable" ? {} : { source };
  }
  if (provider === "go2rtc") {
    const source = candidates[0]?.url;
    return action === "disable" ? {} : { name: cameraId, streams: [source] };
  }
  return action === "disable" ? {} : { camera_id: cameraId, candidates };
}

function playbackUrlsFor(provider: VideoGatewayProvider, gatewayStreamId: string, token?: string) {
  const base = process.env.VIDEO_GATEWAY_PUBLIC_URL ?? process.env.VIDEO_GATEWAY_URL ?? "";
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  if (provider === "mediamtx") {
    return {
      hls_url: `${base}/${encodeURIComponent(gatewayStreamId)}/index.m3u8${suffix}`,
      webrtc_url: `${base}/${encodeURIComponent(gatewayStreamId)}/whep${suffix}`
    };
  }
  if (provider === "go2rtc") {
    return {
      hls_url: `${base}/api/stream.m3u8?src=${encodeURIComponent(gatewayStreamId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`,
      webrtc_url: `${base}/webrtc.html?src=${encodeURIComponent(gatewayStreamId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`
    };
  }
  return {
    hls_url: `${base}/hls/${encodeURIComponent(gatewayStreamId)}/index.m3u8${suffix}`,
    webrtc_url: `${base}/webrtc/${encodeURIComponent(gatewayStreamId)}${suffix}`
  };
}

async function gatewayFetch(path: string, payload?: unknown, methodOverride?: string): Promise<GatewayResult> {
  const provider = getGatewayProvider();
  if (!isGatewayConfigured()) {
    return { configured: false, status: "gateway_required", message: "שרת הווידאו עדיין לא מחובר", provider };
  }
  const started = Date.now();
  try {
    const response = await fetch(`${process.env.VIDEO_GATEWAY_URL}${path}`, {
      method: methodOverride ?? (payload ? "POST" : "GET"),
      headers: {
        "content-type": "application/json",
        "x-video-gateway-key": process.env.VIDEO_GATEWAY_API_KEY ?? process.env.VIDEO_GATEWAY_SIGNING_SECRET ?? ""
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (!response.ok) return { configured: true, status: "error", message: "שרת הווידאו החזיר שגיאה", provider, latencyMs: Date.now() - started };
    const data = await response.json().catch(() => ({}));
    const streamCount = Array.isArray(data) ? data.length : Array.isArray((data as any).items) ? (data as any).items.length : typeof (data as any).streamCount === "number" ? (data as any).streamCount : null;
    const failedStreamCount = typeof (data as any).failedStreamCount === "number" ? (data as any).failedStreamCount : null;
    return { configured: true, status: "healthy", message: "החיבור הצליח", provider, data, latencyMs: Date.now() - started, streamCount, failedStreamCount };
  } catch {
    return { configured: true, status: "error", message: "הפורט חסום או לא נגיש", provider, latencyMs: Date.now() - started };
  }
}

export async function checkGatewayHealth() {
  const provider = getGatewayProvider();
  return gatewayFetch(providerPath(provider, "health"));
}

export async function testCameraSource(input: CameraConnectionInput) {
  const provider = getGatewayProvider();
  const candidates = buildRtspCandidates(input);
  const gateway = await gatewayFetch(providerPath(provider, "test"), providerPayload(provider, "test", "test", candidates));
  return { ...gateway, candidatesTried: candidates.length, reason: gateway.status === "gateway_required" ? "gateway_required" : gateway.status };
}

export async function registerCameraSource(cameraId: string, input: CameraConnectionInput) {
  const provider = getGatewayProvider();
  const streamId = `camera_${cameraId.replaceAll("-", "")}`;
  const candidates = buildRtspCandidates(input);
  const result = await gatewayFetch(providerPath(provider, "register", streamId), providerPayload(provider, "register", streamId, candidates));
  return { ...result, streamId, playback: playbackUrlsFor(provider, streamId) };
}

export async function getPlaybackUrls(gatewayStreamId: string, token?: string) {
  const provider = getGatewayProvider();
  const result = await gatewayFetch(providerPath(provider, "playback", gatewayStreamId));
  return { ...result, playback: playbackUrlsFor(provider, gatewayStreamId, token) };
}

export async function disableCameraSource(gatewayStreamId: string) {
  const provider = getGatewayProvider();
  return gatewayFetch(providerPath(provider, "disable", gatewayStreamId), providerPayload(provider, "disable"), provider === "mediamtx" ? "DELETE" : "POST");
}
