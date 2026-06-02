import { buildRtspCandidates, type CameraConnectionInput } from "@/lib/domain/camera-connection-builder";

export type GatewayResult = {
  configured: boolean;
  status: "healthy" | "gateway_required" | "error";
  message: string;
  provider?: string | null;
  data?: Record<string, unknown> | null;
};

export function isGatewayConfigured() {
  return Boolean(process.env.VIDEO_GATEWAY_URL && (process.env.VIDEO_GATEWAY_API_KEY || process.env.VIDEO_GATEWAY_SIGNING_SECRET));
}

async function gatewayFetch(path: string, payload?: unknown): Promise<GatewayResult> {
  if (!isGatewayConfigured()) {
    return { configured: false, status: "gateway_required", message: "שרת הווידאו עדיין לא מחובר", provider: process.env.VIDEO_GATEWAY_PROVIDER ?? "custom" };
  }
  try {
    const response = await fetch(`${process.env.VIDEO_GATEWAY_URL}${path}`, {
      method: payload ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        "x-video-gateway-key": process.env.VIDEO_GATEWAY_API_KEY ?? process.env.VIDEO_GATEWAY_SIGNING_SECRET ?? ""
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (!response.ok) return { configured: true, status: "error", message: "שרת הווידאו החזיר שגיאה", provider: process.env.VIDEO_GATEWAY_PROVIDER ?? "custom" };
    const data = await response.json().catch(() => ({}));
    return { configured: true, status: "healthy", message: "החיבור הצליח", provider: process.env.VIDEO_GATEWAY_PROVIDER ?? "custom", data };
  } catch {
    return { configured: true, status: "error", message: "הפורט חסום או לא נגיש", provider: process.env.VIDEO_GATEWAY_PROVIDER ?? "custom" };
  }
}

export async function checkGatewayHealth() {
  return gatewayFetch("/health");
}

export async function testCameraSource(input: CameraConnectionInput) {
  const candidates = buildRtspCandidates(input);
  const gateway = await gatewayFetch("/camera/test", { source_type: input.system_type, candidates });
  return { ...gateway, candidatesTried: candidates.length, reason: gateway.status === "gateway_required" ? "gateway_required" : gateway.status };
}

export async function registerCameraSource(cameraId: string, input: CameraConnectionInput) {
  return gatewayFetch("/camera/register", { camera_id: cameraId, candidates: buildRtspCandidates(input) });
}

export async function getPlaybackUrls(gatewayStreamId: string) {
  return gatewayFetch(`/camera/${encodeURIComponent(gatewayStreamId)}/playback`);
}

export async function disableCameraSource(gatewayStreamId: string) {
  return gatewayFetch(`/camera/${encodeURIComponent(gatewayStreamId)}/disable`, {});
}
