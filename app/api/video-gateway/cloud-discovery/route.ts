import { createHmac, timingSafeEqual } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { assertNoForbiddenDiscoveryFields } from "@/lib/domain/video-gateway-discovery-safety";
import { cloudDvrDiscoverySchema, materializeCloudDvrDiscovery } from "@/lib/domain/video-gateway";
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
    if (!gatewayId || !timestamp || !nonce || !signature) return fail("Missing gateway authentication headers.", 401);

    const parsedTimestamp = Date.parse(timestamp);
    if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > MAX_CLOCK_SKEW_MS) {
      return fail("Stale gateway discovery request.", 401);
    }

    const body = await request.text();
    if (!verifySignature(`${timestamp}.${nonce}.${body}`, signature, secret)) return fail("Invalid signature.", 401);

    const payload = cloudDvrDiscoverySchema.parse(JSON.parse(body));
    if (payload.gateway_id !== gatewayId) return fail("Gateway mismatch.", 403);
    if (!isAllowedGateway(payload.gateway_id, payload.garden_id, payload.observer_site_id)) return fail("Gateway is not allowed for this site.", 403);
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
      observer_site_id: result.observer_site_id
    }, 201);
  } catch (error) {
    await markEventProcessed(eventId, "failed", { error: error instanceof Error ? error.message : "unknown" });
    return handleRouteError(error);
  }
}
