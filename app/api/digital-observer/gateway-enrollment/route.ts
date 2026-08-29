import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { gatewayEnrollmentTtlMs, hashGatewayEnrollmentToken, issueGatewayDeviceAccessToken, newGatewayEnrollmentPollToken, newGatewayRefreshToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deviceSchema = z.object({
  device_name: z.string().trim().min(2).max(80),
  device_platform: z.string().trim().min(2).max(40),
  device_fingerprint: z.string().trim().min(16).max(160).optional()
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_request"), ...deviceSchema.shape }),
  z.object({ action: z.literal("approve"), enrollment_request_id: z.string().uuid(), observer_site_id: z.string().uuid() }),
  z.object({ action: z.literal("poll"), enrollment_request_id: z.string().uuid(), poll_token: z.string().min(32).max(160) }),
  z.object({ action: z.literal("refresh"), gateway_id: z.string().uuid(), refresh_token: z.string().min(32).max(160) }),
  z.object({ action: z.literal("revoke"), gateway_id: z.string().uuid(), observer_site_id: z.string().uuid() })
]);

function cloudSecret() { return process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || ""; }
function enrollmentUrl(id: string) { return `/digital-observer/cameras/add?gateway_enrollment=${encodeURIComponent(id)}`; }

async function audit(admin: any, eventType: string, input: Record<string, unknown>) {
  await admin.from("provider_webhook_events").insert({
    webhook_key: "digital_observer_gateway_device_enrollment",
    integration_type: "camera_gateway",
    provider: "digital_observer",
    event_type: eventType,
    event_id: String(input.enrollment_request_id ?? input.gateway_id ?? randomUUID()),
    idempotency_key: `${eventType}:${input.enrollment_request_id ?? input.gateway_id ?? randomUUID()}`,
    signature_valid: true,
    replay_detected: false,
    status: "processed",
    related_entity_type: input.observer_site_id ? "observer_sites" : null,
    related_entity_id: input.observer_site_id ?? null,
    raw_payload_reference: null,
    metadata: { ...input, no_credentials_received: true, no_raw_secrets_stored: true }
  });
}

export async function GET(request: Request) {
  try {
    const query = z.object({ enrollment_request_id: z.string().uuid(), observer_site_id: z.string().uuid() }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const site = await getObserverSiteAccess(session.supabase as any, session.profile, query.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לנהל מכשירים באתר הזה.", 403);
    const enrollment = await (createAdminClient() as any).from("video_gateway_device_enrollments").select("id,status,device_name,device_platform,expires_at").eq("id", query.enrollment_request_id).maybeSingle();
    if (enrollment.error || !enrollment.data) return fail("בקשת קישור המכשיר לא נמצאה.", 404);
    return ok({ enrollment_request_id: enrollment.data.id, status: enrollment.data.status, device_name: enrollment.data.device_name, device_platform: enrollment.data.device_platform, expires_at: enrollment.data.expires_at });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!cloudSecret()) return fail("שירות קישור המכשיר אינו מוגדר.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient() as any;

    if (payload.action === "create_request") {
      const pollToken = newGatewayEnrollmentPollToken();
      const expiresAt = new Date(Date.now() + gatewayEnrollmentTtlMs).toISOString();
      const inserted = await admin.from("video_gateway_device_enrollments").insert({
        device_name: payload.device_name,
        device_platform: payload.device_platform,
        device_fingerprint: payload.device_fingerprint ?? null,
        poll_token_hash: hashGatewayEnrollmentToken(pollToken),
        expires_at: expiresAt,
        metadata: { protocol_version: 1, local_only_credentials: true }
      }).select("id").single();
      if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || "ENROLLMENT_REQUEST_CREATE_FAILED");
      await audit(admin, "gateway_enrollment_requested", { enrollment_request_id: inserted.data.id, device_platform: payload.device_platform });
      return ok({ enrollment_request_id: inserted.data.id, poll_token: pollToken, verification_path: enrollmentUrl(inserted.data.id), expires_at: expiresAt, poll_interval_seconds: 3 }, 201);
    }

    if (payload.action === "approve" || payload.action === "revoke") {
      const session = await getDigitalObserverApiUser(request);
      if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
      const site = await getObserverSiteAccess(session.supabase as any, session.profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה לנהל את המכשיר באתר הזה.", 403);

      if (payload.action === "revoke") {
        const revoked = await admin.from("video_gateway_device_enrollments").update({ status: "revoked", revoked_at: new Date().toISOString(), refresh_token_hash: null }).eq("gateway_id", payload.gateway_id).eq("observer_site_id", site.id).in("status", ["approved", "delivered"]).select("id").maybeSingle();
        if (revoked.error || !revoked.data) return fail("המכשיר לא נמצא או כבר בוטל.", 404);
        await audit(admin, "gateway_enrollment_revoked", { gateway_id: payload.gateway_id, observer_site_id: site.id, actor_profile_id: session.profile.id });
        return ok({ status: "revoked" });
      }

      const pending = await admin.from("video_gateway_device_enrollments").select("id,status,expires_at,device_name,device_platform").eq("id", payload.enrollment_request_id).maybeSingle();
      if (pending.error || !pending.data || pending.data.status !== "pending" || Date.parse(pending.data.expires_at) <= Date.now()) return fail("בקשת קישור המכשיר אינה תקפה או שפג תוקפה.", 409);
      const gatewayId = randomUUID();
      const refreshToken = newGatewayRefreshToken();
      const approved = await admin.from("video_gateway_device_enrollments").update({ status: "approved", observer_site_id: site.id, gateway_id: gatewayId, refresh_token_hash: hashGatewayEnrollmentToken(refreshToken), approved_at: new Date().toISOString(), created_by_profile_id: session.profile.id }).eq("id", pending.data.id).eq("status", "pending").select("id").maybeSingle();
      if (approved.error || !approved.data) return fail("בקשת הקישור כבר טופלה.", 409);
      await audit(admin, "gateway_enrollment_approved", { enrollment_request_id: pending.data.id, gateway_id: gatewayId, observer_site_id: site.id, actor_profile_id: session.profile.id, device_name: pending.data.device_name, device_platform: pending.data.device_platform });
      return ok({ status: "approved", device_name: pending.data.device_name, device_platform: pending.data.device_platform });
    }

    if (payload.action === "poll") {
      const enrollment = await admin.from("video_gateway_device_enrollments").select("id,status,expires_at,poll_token_hash,gateway_id,observer_site_id,refresh_token_hash").eq("id", payload.enrollment_request_id).maybeSingle();
      if (enrollment.error || !enrollment.data || enrollment.data.poll_token_hash !== hashGatewayEnrollmentToken(payload.poll_token)) return fail("בקשת קישור המכשיר אינה תקפה.", 401);
      if (Date.parse(enrollment.data.expires_at) <= Date.now()) {
        await admin.from("video_gateway_device_enrollments").update({ status: "expired" }).eq("id", enrollment.data.id).eq("status", "pending");
        return ok({ status: "expired" });
      }
      if (enrollment.data.status === "pending") return ok({ status: "pending" });
      if (enrollment.data.status !== "approved" || !enrollment.data.gateway_id || !enrollment.data.observer_site_id || !enrollment.data.refresh_token_hash) return fail("בקשת קישור המכשיר אינה זמינה.", 409);
      const refreshToken = newGatewayRefreshToken();
      const delivered = await admin.from("video_gateway_device_enrollments").update({ status: "delivered", delivered_at: new Date().toISOString(), refresh_token_hash: hashGatewayEnrollmentToken(refreshToken), poll_token_hash: hashGatewayEnrollmentToken(randomUUID()) }).eq("id", enrollment.data.id).eq("status", "approved").select("id").maybeSingle();
      if (delivered.error || !delivered.data) return fail("בקשת קישור המכשיר כבר נצרכה.", 409);
      const accessToken = issueGatewayDeviceAccessToken({ device_id: enrollment.data.id, gateway_id: enrollment.data.gateway_id, observer_site_id: enrollment.data.observer_site_id }, cloudSecret());
      await audit(admin, "gateway_enrollment_delivered", { enrollment_request_id: enrollment.data.id, gateway_id: enrollment.data.gateway_id, observer_site_id: enrollment.data.observer_site_id });
      return ok({ status: "linked", gateway_id: enrollment.data.gateway_id, observer_site_id: enrollment.data.observer_site_id, refresh_token: refreshToken, access_token: accessToken, access_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    }

    const enrollment = await admin.from("video_gateway_device_enrollments").select("id,status,observer_site_id,refresh_token_hash").eq("gateway_id", payload.gateway_id).maybeSingle();
    if (enrollment.error || !enrollment.data || enrollment.data.status !== "delivered" || enrollment.data.refresh_token_hash !== hashGatewayEnrollmentToken(payload.refresh_token) || !enrollment.data.observer_site_id) return fail("זהות Gateway אינה תקפה או בוטלה.", 401);
    const nextRefreshToken = newGatewayRefreshToken();
    const rotated = await admin.from("video_gateway_device_enrollments").update({ refresh_token_hash: hashGatewayEnrollmentToken(nextRefreshToken), updated_at: new Date().toISOString() }).eq("id", enrollment.data.id).eq("status", "delivered").eq("refresh_token_hash", enrollment.data.refresh_token_hash).select("id").maybeSingle();
    if (rotated.error || !rotated.data) return fail("זהות Gateway השתנתה. יש לבצע קישור מחדש.", 409);
    const accessToken = issueGatewayDeviceAccessToken({ device_id: enrollment.data.id, gateway_id: payload.gateway_id, observer_site_id: enrollment.data.observer_site_id }, cloudSecret());
    await audit(admin, "gateway_device_access_rotated", { gateway_id: payload.gateway_id, observer_site_id: enrollment.data.observer_site_id });
    return ok({ gateway_id: payload.gateway_id, observer_site_id: enrollment.data.observer_site_id, refresh_token: nextRefreshToken, access_token: accessToken, access_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  } catch (error) {
    return handleRouteError(error);
  }
}

