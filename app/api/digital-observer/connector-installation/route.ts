/* eslint-disable @typescript-eslint/no-explicit-any -- migration-backed install intent table, not in generated schema yet. */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { installIntentRequestSchema, connectorInstallVersion, installationStage } from "@/lib/domain/digital-observer/connector-installation";
import { hashGatewayEnrollmentToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { assessAuthorizedCameraSystem } from "@/lib/domain/digital-observer/connection-assessment-service";
import { connectorRelease, connectorReleasePlatforms } from "@/lib/domain/digital-observer/connector-release";
import { connectivityFamilyIds } from "@/lib/domain/digital-observer/connectivity-registry";

export const runtime = "nodejs";
const releaseQuerySchema = z.object({ action: z.enum(["manifest", "download"]), observer_site_id: z.string().uuid(),
  family: z.enum(connectivityFamilyIds), platform: z.enum(connectorReleasePlatforms) }).strict();

export async function GET(request: Request) {
  try {
    const query = releaseQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות.", 401);
    const site = await getObserverSiteAccess(session.supabase, session.profile, query.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה להוריד רכיב חיבור לבית הזה.", 403);
    const { plan } = await assessAuthorizedCameraSystem(site.id, query.family, "YES");
    if (!["INSTALL_CONNECTOR", "DISCOVER"].includes(plan.nextAction) || !["SOFTWARE_CONNECTOR", null].includes(plan.preferredStrategy)) {
      return fail("רכיב מקומי אינו מסלול החיבור המתאים למערכת הזו.", 409);
    }
    const release = connectorRelease(query.platform);
    if (!release.available) return query.action === "manifest" ? privateResponse(release) : fail("חבילת ההתקנה עדיין אינה זמינה להפצה.", 503);
    if (query.action === "manifest") return privateResponse({ available: true, platform: release.platform,
      filename: release.filename, sha256: release.sha256, version: release.version, build: release.build,
      download_path: `/api/digital-observer/connector-installation?action=download&observer_site_id=${site.id}&family=${query.family}&platform=${query.platform}` });
    if (release.source === "REMOTE") return NextResponse.redirect(release.url, { status: 307,
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    return new NextResponse(readFileSync(release.path), { status: 200, headers: { "Content-Type": query.platform.startsWith("macos") ? "application/x-apple-diskimage" : "application/x-msi",
      "Content-Disposition": `attachment; filename="${release.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const payload = installIntentRequestSchema.parse(await parseBoundedJson(request, 4096));
    const admin = createAdminClient() as any;
    if (payload.action === "claim") {
      // Native application only; possession of the short-lived document is NOT
      // activation authorization. Original Product actor must still approve.
      await assertRateLimit(privateRateLimitIdentifier({ headers: request.headers, tenantId: payload.document.observer_site_id }), "connector-install-claim", 10, 60);
      if (Date.parse(payload.document.expires_at) <= Date.now()) return fail("בקשת ההתקנה פגה. צרו בקשה חדשה באשף.", 409);
      const claimed = await admin.rpc("claim_observer_connector_install_intent", {
        p_id: payload.document.intent_id, p_secret_hash: hashGatewayEnrollmentToken(payload.document.secret),
        p_site: payload.document.observer_site_id, p_enrollment: payload.enrollment_id,
        p_poll_hash: hashGatewayEnrollmentToken(payload.poll_token), p_installation: payload.installation_id,
        p_platform: payload.platform, p_version: payload.software_version, p_build: payload.build_sha,
        p_credential_algorithm: payload.credential_algorithm,
        p_credential_public_key_spki: payload.credential_public_key_spki
      });
      if (claimed.error) return fail("בקשת ההתקנה אינה זמינה או שכבר נוצלה.", 409);
      return privateResponse({ status: "CONFIRM_COMPUTER" });
    }
    assertTrustedMutationOrigin(request);
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות.", 401);
    const site = await getObserverSiteAccess(session.supabase, session.profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה להתקין רכיב חיבור לבית הזה.", 403);
    await assertRateLimit(privateRateLimitIdentifier({ headers: request.headers, userId: session.profile.id, tenantId: site.id }), "connector-install-product", 30, 60);
    if (payload.action === "create") {
      const { plan } = await assessAuthorizedCameraSystem(site.id, payload.family, "YES");
      if (plan.nextAction !== "INSTALL_CONNECTOR") return fail("חזרו לבדיקת אפשרויות החיבור באשף; התקנת רכיב מקומי אינה הצעד המתאים כעת.", 409);
      const id = randomUUID(), secret = randomBytes(32).toString("base64url");
      const created = new Date(), expires = new Date(created.getTime() + 10 * 60000);
      const inserted = await admin.from("observer_connector_install_intents").insert({ id, observer_site_id: site.id,
        actor_profile_id: session.profile.id, secret_hash: hashGatewayEnrollmentToken(secret), created_at: created.toISOString(), expires_at: expires.toISOString() });
      if (inserted.error) return fail("שירות ההתקנה עדיין אינו זמין. נסו שוב מאוחר יותר.", 503);
      await writeAuditEvent({ eventType: "connector_install_started", eventCategory: "camera", actorProfileId: session.profile.id,
        targetType: "observer_site", targetId: site.id, requestId: id, metadata: { version: connectorInstallVersion,
          family: plan.family, strategy: plan.preferredStrategy, technical_capability: plan.technicalCapability,
          product_coverage: plan.productCoverage, requirement_basis: plan.requirementBasis }, riskLevel: "low" });
      return privateResponse({ document: { version: connectorInstallVersion, intent_id: id, observer_site_id: site.id, secret,
        expires_at: expires.toISOString(), origin: "https://ganbatuach.com" }, resume_path: `/digital-observer/cameras/add?site=${site.id}&install_intent=${id}` });
    }
    const result = await admin.from("observer_connector_install_intents").select("id,state,expires_at,enrollment_id")
      .eq("id", payload.intent_id).eq("observer_site_id", site.id).eq("actor_profile_id", session.profile.id).maybeSingle();
    if (result.error || !result.data) return fail("בקשת ההתקנה לא נמצאה בחשבון הזה.", 404);
    const intent = result.data;
    const enrolled = intent.enrollment_id ? await admin.from("video_gateway_device_enrollments")
      .select("id,status,metadata,device_platform").eq("id", intent.enrollment_id).eq("observer_site_id", site.id)
      .eq("created_by_profile_id", session.profile.id).maybeSingle() : { data: null, error: null };
    if (enrolled.error) return fail("מצב רכיב החיבור אינו זמין כרגע.", 503);
    return privateResponse({ intent_id: intent.id, enrollment_id: enrolled.data?.id ?? null,
      platform: enrolled.data?.device_platform ?? null, expires_at: intent.expires_at,
      stage: installationStage({ state: intent.state, expiresAt: intent.expires_at,
        enrollmentStatus: enrolled.data?.status, heartbeatAt: enrolled.data?.metadata?.last_heartbeat_at }) });
  } catch (error) { return handleSafeRouteError(error); }
}
function privateResponse(data: unknown) { const response = ok(data); response.headers.set("Cache-Control", "private, no-store"); return response; }
