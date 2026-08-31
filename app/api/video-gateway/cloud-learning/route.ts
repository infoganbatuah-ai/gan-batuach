import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { recordHomeActivityMetrics } from "@/lib/domain/digital-observer/home-learning-sampler";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { observerAnalysisRoundPolicy } from "@/lib/domain/digital-observer/analysis-round-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const envelope = {
  gateway_id: z.string().min(1).max(128),
  observer_site_id: z.string().uuid(),
  sample_id: z.string().uuid(),
  sampled_at: z.string().datetime(),
  local_processing: z.literal(true),
  no_raw_video_returned: z.literal(true)
};
const payloadSchema = z.union([z.object({
  ...envelope,
  operation: z.literal("authorize_round"),
  source_ids: z.array(z.string().uuid()).min(1).max(128).refine(ids => new Set(ids).size === ids.length)
}).strict(), z.object({
  ...envelope,
  operation: z.literal("record_samples").default("record_samples"),
  samples: z.array(z.object({
    stream_id: z.string().min(1).max(160),
    motion_score: z.number().min(0).max(1),
    luminance_score: z.number().min(0).max(1),
    sampled_at: z.string().datetime(),
    sample_frames: z.number().int().min(1).max(2)
  }).strict()).min(1).max(64)
}).strict()]);

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
  return safeEqual(expected, signature.replace(/^sha256=/, ""));
}

function allowed(gatewayId: string, observerSiteId: string) {
  return String(process.env.VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS ?? "")
    .split(",")
    .map((item) => item.trim())
    .includes(`${gatewayId}:${observerSiteId}`);
}

export async function POST(request: Request) {
  try {
    const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
    if (!secret) return fail("Cloud learning endpoint is not configured.", 404);
    const gatewayId = header(request, "x-video-gateway-id");
    const timestamp = header(request, "x-video-gateway-timestamp");
    const nonce = header(request, "x-video-gateway-nonce");
    const signature = header(request, "x-video-gateway-signature");
    const deviceToken = header(request, "x-video-gateway-device-token");
    const parsedTimestamp = Date.parse(timestamp);
    if (!gatewayId || gatewayId.length > 128 || !nonce || nonce.length > 128 || (!signature && !deviceToken) || !Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > MAX_CLOCK_SKEW_MS) return fail("Invalid gateway authentication.", 401);
    if (Number(request.headers.get("content-length") || 0) > 64 * 1024) return fail("Payload too large.", 413);
    const body = await request.text();
    if (Buffer.byteLength(body) > 64 * 1024) return fail("Payload too large.", 413);
    const payload = payloadSchema.parse(JSON.parse(body));
    const device = deviceToken ? verifyGatewayDeviceAccessToken(deviceToken, secret) : null;
    if (device) {
      if (device.gateway_id !== gatewayId || device.observer_site_id !== payload.observer_site_id || payload.gateway_id !== gatewayId) return fail("Gateway device is not authorized for this site.", 403);
      const enrollment = await createAdminClient().from("video_gateway_device_enrollments" as any)
        .select("id")
        .eq("id", device.device_id)
        .eq("gateway_id", device.gateway_id)
        .eq("observer_site_id", device.observer_site_id)
        .eq("status", "delivered")
        .maybeSingle();
      if (!enrollment.data) return fail("Gateway device access was revoked.", 401);
    } else {
      if (!verifySignature(`${timestamp}.${nonce}.${body}`, signature, secret)) return fail("Invalid signature.", 401);
      if (payload.gateway_id !== gatewayId || !allowed(gatewayId, payload.observer_site_id)) return fail("Gateway is not allowed for this site.", 403);
    }

    const supabase = createAdminClient() as any;
    const idempotencyKey = `${gatewayId}:${nonce}`;
    const existing = await supabase.from("provider_webhook_events").select("id").eq("webhook_key", "video_gateway_cloud_learning").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) return fail("Replay verification unavailable.", 503);
    if (existing.data?.id) return fail("Replay detected.", 409);
    const event = await supabase.from("provider_webhook_events").insert({
      webhook_key: "video_gateway_cloud_learning",
      integration_type: "camera_gateway",
      provider: gatewayId,
      event_type: payload.operation === "authorize_round" ? "analysis_policy" : "activity_metrics",
      event_id: payload.sample_id,
      idempotency_key: idempotencyKey,
      signature_valid: true,
      replay_detected: false,
      status: "verified",
      related_entity_type: "observer_sites",
      related_entity_id: payload.observer_site_id,
      raw_payload_reference: null,
      metadata: { sample_count: payload.operation === "authorize_round" ? 0 : payload.samples.length, no_raw_payload_stored: true, raw_video_received: false }
    }).select("id").single();
    if (event.error) return fail("Unable to register gateway request.", event.error.code === "23505" ? 409 : 503);

    if (payload.operation === "authorize_round") {
      const site = await supabase.from("observer_sites").select("id,active,monitoring_enabled,vision_privacy_mode,business_handles_children,metadata").eq("id", payload.observer_site_id).maybeSingle();
      const schedule = await supabase.from("observer_monitoring_schedules").select("observer_site_id,schedule_mode,status").eq("observer_site_id", payload.observer_site_id).maybeSingle();
      const sources = await supabase.from("digital_observer_camera_sources").select("id,observer_site_id,status,health_status,metadata")
        .eq("observer_site_id", payload.observer_site_id).in("id", payload.source_ids);
      if (site.error || schedule.error || sources.error) return fail("Analysis policy verification unavailable.", 503);
      const policy = observerAnalysisRoundPolicy(site.data, schedule.data, sources.data ?? [], gatewayId, payload.source_ids, payload.sample_id);
      const completed = await supabase.from("provider_webhook_events").update({
        status: "processed", processed_at: new Date().toISOString(),
        metadata: { sample_count: 0, no_raw_payload_stored: true, raw_video_received: false,
          authorized_source_count: policy.sourceIds.length, consent_verified: policy.consentVerified,
          policy_reason: policy.reason, expires_at: new Date(policy.expiresAt).toISOString() }
      }).eq("id", event.data.id);
      if (completed.error) return fail("Analysis policy audit unavailable.", 503);
      return ok({ status: "analysis_policy", policy, raw_video_received: false });
    }

    const result = await recordHomeActivityMetrics(supabase, payload.observer_site_id, payload.samples, gatewayId);
    await supabase.from("provider_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", event.data.id);
    return ok({ status: "learned", ...result, raw_video_received: false }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
