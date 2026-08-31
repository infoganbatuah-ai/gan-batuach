import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGatewayDeviceAccessToken, verifyGatewayPlaybackGrant } from "@/lib/domain/gateway-device-enrollment";
import { gatewayRelayOrigin, issueGatewayRelayAccess, verifyGatewayRelayAccess } from "@/lib/domain/gateway-relay-auth";
import { digitalObserverCameraIsConnected } from "@/lib/domain/digital-observer/camera-live-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lease") }).strict(),
  z.object({ action: z.literal("inspect"), kind: z.enum(["transport", "viewer"]), token: z.string().min(32).max(4096) }).strict()
]);

async function readPayload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5000) return null;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); }
}

export async function POST(request: Request) {
  try {
    if (process.env.VIDEO_GATEWAY_REMOTE_RELAY_ENABLED !== "true") return fail("Remote media relay is not configured.", 503);
    const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
    if (!secret) return fail("Relay authorization is unavailable.", 503);
    const raw = await readPayload(request);
    if (raw === null) return fail("Request is empty or too large.", 413);
    const payload = schema.parse(raw);
    const claims = payload.action === "lease"
      ? verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret)
      : payload.kind === "transport" ? verifyGatewayRelayAccess(payload.token, secret) : verifyGatewayPlaybackGrant(payload.token, secret);
    if (!claims) return fail("Relay permission is invalid or expired.", 401);
    const admin = createAdminClient() as any;
    let query = admin.from("video_gateway_device_enrollments").select("id")
      .eq("gateway_id", claims.gateway_id).eq("observer_site_id", claims.observer_site_id).eq("status", "delivered");
    if ("device_id" in claims) query = query.eq("id", claims.device_id);
    const enrollment = await query.limit(1).maybeSingle();
    if (enrollment.error || !enrollment.data) return fail("Gateway device access was revoked.", 401);

    if (payload.action === "lease" && "device_id" in claims) {
      return ok({ ...issueGatewayRelayAccess(claims, secret), relay_origin: gatewayRelayOrigin });
    }
    if ("camera_source_id" in claims) {
      const source = await admin.from("digital_observer_camera_sources").select("id,metadata,status,health_status")
        .eq("id", claims.camera_source_id).eq("observer_site_id", claims.observer_site_id).maybeSingle();
      if (source.error || !source.data || !digitalObserverCameraIsConnected(source.data)
        || source.data.metadata?.gateway_id !== claims.gateway_id || source.data.metadata?.gateway_stream_id !== claims.gateway_stream_id) {
        return fail("Source is offline or no longer mapped to this Gateway.", 403);
      }
    }
    // No DVR address, media token, stream URL, refresh token, or signing key leaves this route.
    return ok({ gateway_id: claims.gateway_id, observer_site_id: claims.observer_site_id, expires_at: claims.exp });
  } catch (error) { return handleRouteError(error); }
}
