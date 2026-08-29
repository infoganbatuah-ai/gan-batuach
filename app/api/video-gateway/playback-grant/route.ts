import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { verifyGatewayDeviceAccessToken, verifyGatewayPlaybackGrant } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ grant: z.string().min(32).max(4096) });

export async function POST(request: Request) {
  try {
    const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
    if (!secret) return fail("Playback grant service is not configured.", 503);
    const device = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret);
    if (!device) return fail("Gateway device authentication failed.", 401);
    const payload = schema.parse(await request.json());
    const grant = verifyGatewayPlaybackGrant(payload.grant, secret);
    if (!grant) return fail("Playback grant is invalid or expired.", 401);
    if (grant.gateway_id !== device.gateway_id || grant.observer_site_id !== device.observer_site_id) return fail("Playback grant is outside this Gateway scope.", 403);

    const admin = createAdminClient() as any;
    const enrolled = await admin.from("video_gateway_device_enrollments").select("id").eq("id", device.device_id).eq("gateway_id", device.gateway_id).eq("observer_site_id", device.observer_site_id).eq("status", "delivered").maybeSingle();
    if (enrolled.error || !enrolled.data) return fail("Gateway device access was revoked.", 401);
    const source = await admin.from("digital_observer_camera_sources").select("id,observer_site_id,metadata,status,health_status").eq("id", grant.camera_source_id).eq("observer_site_id", device.observer_site_id).maybeSingle();
    if (source.error || !source.data || String(source.data.metadata?.gateway_id || "") !== device.gateway_id || String(source.data.metadata?.gateway_stream_id || "") !== grant.gateway_stream_id) return fail("Playback source is no longer mapped to this Gateway.", 403);

    const audit = await admin.from("provider_webhook_events").insert({
      webhook_key: "digital_observer_gateway_playback_grant",
      integration_type: "camera_gateway",
      provider: "digital_observer",
      event_type: "gateway_playback_grant_redeemed",
      event_id: grant.nonce,
      idempotency_key: `gateway_playback_grant:${grant.nonce}`,
      signature_valid: true,
      replay_detected: false,
      status: "processed",
      related_entity_type: "observer_sites",
      related_entity_id: device.observer_site_id,
      raw_payload_reference: null,
      metadata: { gateway_id: device.gateway_id, observer_site_id: device.observer_site_id, camera_source_id: grant.camera_source_id, no_credentials_received: true, no_private_endpoint_received: true }
    });
    if (audit.error?.code === "23505") return fail("Playback grant replay detected.", 409);
    if (audit.error) throw new Error(audit.error.message);

    return ok({ status: "authorized", gateway_stream_id: grant.gateway_stream_id, expires_in_seconds: 300 });
  } catch (error) {
    return handleRouteError(error);
  }
}
