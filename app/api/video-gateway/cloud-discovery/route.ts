import { createHmac, timingSafeEqual } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { assertNoForbiddenDiscoveryFields } from "@/lib/domain/video-gateway-discovery-safety";
import { cloudDvrDiscoverySchema, materializeCloudDvrDiscovery } from "@/lib/domain/video-gateway";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { verifyGatewayDiscoveryToken } from "@/lib/domain/video-gateway-pairing";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function header(request: Request, name: string) {
  return request.headers.get(name)?.trim() || "";
}

function safeEqual(left: string, right: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifySignature(body: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const received = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  return safeEqual(expected, received);
}

function allowedGatewaySitePairs() {
  return new Set(
    String(process.env.VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function isAllowedGateway(gatewayId: string, gardenId?: string | null, observerSiteId?: string) {
  const allowlist = allowedGatewaySitePairs();
  if (!allowlist.size) return false;
  return Boolean(gardenId && allowlist.has(`${gatewayId}:${gardenId}`))
    || Boolean(observerSiteId && allowlist.has(`${gatewayId}:${observerSiteId}`));
}

async function assertFreshNonce(input: { gatewayId: string; nonce: string; timestamp: string; discoveryId: string; gardenId?: string | null; observerSiteId?: string | null }) {
  const supabase = createAdminClient();
  const idempotencyKey = `${input.gatewayId}:${input.nonce}`;
  const existing = await supabase
    .from("provider_webhook_events" as any)
    .select("id")
    .eq("webhook_key", "video_gateway_cloud_discovery")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.data?.id) return { ok: false, supabase };

  const insert = await supabase
    .from("provider_webhook_events" as any)
    .insert({
      webhook_key: "video_gateway_cloud_discovery",
      integration_type: "camera_gateway",
      provider: input.gatewayId,
      event_type: "dvr_discovery",
      event_id: input.discoveryId,
      idempotency_key: idempotencyKey,
      signature_valid: true,
      replay_detected: false,
      status: "verified",
      related_entity_type: input.gardenId ? "gardens" : "observer_sites",
      related_entity_id: input.gardenId ?? input.observerSiteId ?? null,
      raw_payload_reference: null,
      processed_at: null,
      metadata: {
        gateway_id: input.gatewayId,
        nonce_present: true,
        timestamp: input.timestamp,
        no_raw_payload_stored: true
      }
    } as any)
    .select("id")
    .single();
  if (insert.error) throw new Error(insert.error.message);
  return { ok: true, eventId: insert.data?.id, supabase };
}

async function markEventProcessed(eventId: string | undefined, status: "processed" | "failed", metadata: Record<string, unknown>) {
  if (!eventId) return;
  const supabase = createAdminClient();
  await supabase
    .from("provider_webhook_events" as any)
    .update({
      status,
      processed_at: new Date().toISOString(),
      metadata
    } as any)
    .eq("id", eventId);
}

export async function POST(request: Request) {
  let eventId: string | undefined;
  try {
    const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
    if (!secret) return fail("Cloud discovery endpoint is not configured.", 404);

    const gatewayId = header(request, "x-video-gateway-id");
    const timestamp = header(request, "x-video-gateway-timestamp");
    const nonce = header(request, "x-video-gateway-nonce");
    const signature = header(request, "x-video-gateway-signature");
    const pairingToken = header(request, "x-video-gateway-pairing-token");
    const deviceToken = header(request, "x-video-gateway-device-token");
    if (!gatewayId || !timestamp || !nonce) return fail("Missing gateway authentication headers.", 401);

    const parsedTimestamp = Date.parse(timestamp);
    if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > MAX_CLOCK_SKEW_MS) {
      return fail("Stale gateway discovery request.", 401);
    }

    const body = await request.text();
    const pairing = pairingToken ? verifyGatewayDiscoveryToken(pairingToken, secret) : null;
    const device = deviceToken ? verifyGatewayDeviceAccessToken(deviceToken, secret) : null;
    const legacySignatureValid = Boolean(signature) && verifySignature(`${timestamp}.${nonce}.${body}`, signature, secret);
    if (!pairing && !device && !legacySignatureValid) return fail("Invalid gateway authentication.", 401);

    const payload = cloudDvrDiscoverySchema.parse(JSON.parse(body));
    if (payload.gateway_id !== gatewayId) return fail("Gateway mismatch.", 403);
    if (pairing) {
      if (payload.gateway_id !== pairing.gateway_id || payload.observer_site_id !== pairing.observer_site_id || payload.garden_id) return fail("Pairing token is not authorized for this site.", 403);
    } else if (device) {
      if (payload.gateway_id !== device.gateway_id || payload.observer_site_id !== device.observer_site_id || payload.garden_id) return fail("Gateway device token is not authorized for this site.", 403);
      const enrolled = await createAdminClient().from("video_gateway_device_enrollments" as any).select("id").eq("id", device.device_id).eq("gateway_id", device.gateway_id).eq("observer_site_id", device.observer_site_id).eq("status", "delivered").maybeSingle();
      if (enrolled.error || !enrolled.data) return fail("Gateway device access was revoked.", 401);
    } else if (!isAllowedGateway(payload.gateway_id, payload.garden_id, payload.observer_site_id)) return fail("Gateway is not allowed for this site.", 403);
    assertNoForbiddenDiscoveryFields(payload);

    const replay = await assertFreshNonce({
      gatewayId: payload.gateway_id,
      nonce,
      timestamp,
      discoveryId: payload.discovery_id,
      gardenId: payload.garden_id,
      observerSiteId: payload.observer_site_id
    });
    if (!replay.ok) return fail("Replay detected.", 409);
    eventId = replay.eventId as string | undefined;

    const result = await materializeCloudDvrDiscovery(payload);
    await markEventProcessed(eventId, "processed", {
      gateway_id: payload.gateway_id,
      discovery_id: payload.discovery_id,
      channel_count: result.channel_count,
      connected_channel_count: result.connected_channel_count,
      observer_site_id: result.observer_site_id,
      no_secrets_received: true,
      ai_shadow_only: true
    });
    return ok({
      status: "mapped",
      channel_count: result.channel_count,
      connected_channel_count: result.connected_channel_count,
      observer_site_id: result.observer_site_id,
      channels: result.channels.map((item: any) => ({
        camera_source_id: item.observer_source?.id ?? null,
        gateway_stream_id: item.gateway_stream_id ?? null,
        status: item.observer_source?.status ?? null,
        health_status: item.observer_source?.health_status ?? null
      }))
    }, 201);
  } catch (error) {
    await markEventProcessed(eventId, "failed", { error: error instanceof Error ? error.message : "unknown" });
    return handleRouteError(error);
  }
}
