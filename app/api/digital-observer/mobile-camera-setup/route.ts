/* eslint-disable @typescript-eslint/no-explicit-any -- onboarding draft metadata is migration-backed outside the generated client snapshot. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { assessAuthorizedCameraSystem } from "@/lib/domain/digital-observer/connection-assessment-service";
import { mobileSetupReceiptSchema, validateMobileSetupReceipt } from "@/lib/domain/digital-observer/mobile-camera-setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

const scope = z.object({ observer_site_id: z.string().uuid() }).strict();
const schema = z.discriminatedUnion("action", [
  scope.extend({ action: z.literal("start") }),
  scope.extend({ action: z.literal("status"), session_id: z.string().uuid() }),
  scope.extend({ action: z.literal("submit"), session_id: z.string().uuid(), receipt: mobileSetupReceiptSchema })
]);
const nativeEnabled = () => process.env.OBSERVER_MOBILE_LOCAL_DISCOVERY_ENABLED === "1";

async function loadDraft(admin: ReturnType<typeof createAdminClient>, profileId: string, siteId: string) {
  return admin.from("observer_site_onboarding_drafts" as any).select("id,metadata,updated_at")
    .eq("profile_id", profileId).eq("activated_observer_site_id", siteId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
}
async function save(admin: ReturnType<typeof createAdminClient>, profile: any, site: any, current: any, sessionId: string, value: any) {
  const metadata = current?.metadata && typeof current.metadata === "object" ? current.metadata : {};
  const sessions = metadata.mobile_camera_setup && typeof metadata.mobile_camera_setup === "object" ? metadata.mobile_camera_setup : {};
  const patch = { profile_id: profile.id, status: "activated", site_name: site.name, site_type: site.site_type,
    owner_type: site.site_type === "home" ? "home_owner" : "business_owner", timezone: site.timezone || "Asia/Jerusalem",
    activated_observer_site_id: site.id, metadata: { ...metadata, mobile_camera_setup: { ...sessions, [sessionId]: value } }, updated_at: new Date().toISOString() };
  const result = current?.id ? await admin.from("observer_site_onboarding_drafts" as any).update(patch).eq("id", current.id)
    : await admin.from("observer_site_onboarding_drafts" as any).insert(patch);
  if (result.error) throw new Error("MOBILE_SETUP_SAVE_FAILED");
}

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const user = await getDigitalObserverApiUser(request); if (!user) return fail("נדרשת התחברות.", 401);
    const payload = schema.parse(await parseBoundedJson(request, 12 * 1024));
    const site = await getObserverSiteAccess(user.supabase, user.profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לחפש מצלמות באתר הזה.", 403);
    await assertRateLimit(privateRateLimitIdentifier({ userId: user.profile.id, tenantId: site.id, headers: request.headers }), "mobile-camera-setup", 30, 60);
    const admin = createAdminClient(); const current = await loadDraft(admin, user.profile.id, site.id);
    if (current.error) throw new Error("MOBILE_SETUP_READ_FAILED");
    const sessions = current.data?.metadata?.mobile_camera_setup ?? {};
    if (payload.action === "start") {
      const sessionId = randomUUID(), now = new Date(), expires = new Date(now.getTime() + 10 * 60_000);
      const value = { state: nativeEnabled() ? "WAITING_FOR_PERMISSION" : "NATIVE_DISCOVERY_UNAVAILABLE",
        created_at: now.toISOString(), expires_at: expires.toISOString(), candidates: [], temporary_setup_only: true, persistent_monitoring_verified: false };
      await save(admin, user.profile, site, current.data, sessionId, value);
      return privateResponse({ session_id: sessionId, ...value });
    }
    const existing = sessions[payload.session_id];
    if (!existing || Date.parse(existing.expires_at ?? "") <= Date.now()) return fail("בקשת החיפוש פגה. התחילו חיפוש חדש.", 409);
    if (payload.action === "status") return privateResponse({ session_id: payload.session_id, ...existing });
    const receipt = validateMobileSetupReceipt(payload.receipt, { siteId: site.id, sessionId: payload.session_id, nativeCapabilityAvailable: nativeEnabled() });
    const family = receipt.candidates[0]?.family ?? "unknown";
    const { plan } = await assessAuthorizedCameraSystem(site.id, family, "UNKNOWN", true);
    const value = { ...existing, state: receipt.permission === "GRANTED" ? "DISCOVERY_RECEIVED" : receipt.permission,
      permission: receipt.permission, candidates: receipt.candidates, submitted_at: new Date().toISOString(),
      temporary_setup_only: true, persistent_monitoring_verified: false, plan_version: plan.version, next_action: plan.nextAction };
    await save(admin, user.profile, site, current.data, payload.session_id, value);
    await writeAuditEvent({ eventType: "mobile_camera_discovery_received", eventCategory: "camera", actorProfileId: user.profile.id,
      targetType: "observer_site", targetId: site.id, requestId: payload.session_id, riskLevel: "low", metadata: {
        permission: receipt.permission, candidate_count: receipt.candidates.length, family, next_action: plan.nextAction,
        temporary_setup_only: true, persistent_monitoring_verified: false, private_network_inventory_stored: false } });
    return privateResponse({ session_id: payload.session_id, plan, candidate_count: receipt.candidates.length,
      temporary_setup_only: true, persistent_monitoring_verified: false });
  } catch (error) { return handleSafeRouteError(error); }
}
function privateResponse(data: unknown) { const response = ok(data); response.headers.set("Cache-Control", "private, no-store"); return response; }
