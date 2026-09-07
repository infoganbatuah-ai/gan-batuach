/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 18 migration is intentionally ahead of generated Supabase types. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { authenticateManagedDeviceRequest } from "@/lib/domain/digital-observer/managed-device-auth-service";
import { publicKeySpkiSchema, verifyRotationConfirmation } from "@/lib/domain/digital-observer/managed-device-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMutationOrigin } from "@/lib/security/request-guards";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rotatePrepareSchema = z.object({ action: z.literal("rotate_prepare"), gateway_id: z.string().uuid(),
  new_credential_algorithm: z.literal("Ed25519"), new_public_key_spki: publicKeySpkiSchema }).strict();
const rotateConfirmSchema = z.object({ action: z.literal("rotate_confirm"), gateway_id: z.string().uuid(),
  rotation_id: z.string().uuid(), new_credential_version: z.number().int().positive(),
  challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), signature: z.string().regex(/^[A-Za-z0-9_-]{64,128}$/) }).strict();
const legacyMigrationPrepareSchema = z.object({ action: z.literal("legacy_migration_prepare"),
  gateway_id: z.string().uuid(), observer_site_id: z.string().uuid(),
  new_credential_algorithm: z.literal("Ed25519"), new_public_key_spki: publicKeySpkiSchema }).strict();
const lifecycleSchema = z.object({ action: z.literal("lifecycle"), gateway_id: z.string().uuid(),
  observer_site_id: z.string().uuid(), state: z.enum(["REVOKED", "LOST", "REPLACED", "RETIRED"]),
  reason: z.string().trim().min(3).max(160) }).strict();
const replaceSchema = z.object({ action: z.literal("replace"), observer_site_id: z.string().uuid(),
  old_gateway_id: z.string().uuid(), new_gateway_id: z.string().uuid() }).strict();
const schema = z.discriminatedUnion("action", [rotatePrepareSchema, rotateConfirmSchema,
  legacyMigrationPrepareSchema, lifecycleSchema, replaceSchema]);

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 8192) return fail("Device identity request is too large.", 413);
    const payload = schema.parse(JSON.parse(raw));
    const admin = createAdminClient() as any;

    if (payload.action === "rotate_prepare") {
      const authRequest = new Request(request.url, { method: "POST", headers: request.headers, body: raw });
      const authenticated = await authenticateManagedDeviceRequest({ request: authRequest, admin,
        operation: "CREDENTIAL_ROTATE", bodyText: raw });
      if (!authenticated || authenticated.authMode !== "ED25519_V1" || authenticated.principal.deviceId !== payload.gateway_id) {
        return fail("Device credential is invalid or outside scope.", 401);
      }
      const principal = authenticated.principal;
      const active = await admin.from("observer_managed_device_credentials").select("public_key_spki")
        .eq("enrollment_id", principal.enrollmentId).eq("credential_state", "ACTIVE").maybeSingle();
      if (active.error || !active.data || active.data.public_key_spki === payload.new_public_key_spki) {
        return fail("A distinct replacement credential is required.", 409);
      }
      const nextVersion = principal.credentialVersion + 1;
      const rotationId = randomUUID(), challenge = randomBytes(32).toString("base64url");
      const credential = await admin.from("observer_managed_device_credentials").insert({ id: randomUUID(),
        enrollment_id: principal.enrollmentId, credential_version: nextVersion, algorithm: "Ed25519",
        public_key_spki: payload.new_public_key_spki, credential_state: "PENDING" });
      if (credential.error) return fail("Credential rotation is already pending.", 409);
      const rotation = await admin.from("observer_managed_device_rotations").insert({ id: rotationId,
        enrollment_id: principal.enrollmentId, old_credential_version: principal.credentialVersion,
        new_credential_version: nextVersion, challenge_hash: createHash("sha256").update(challenge).digest("hex"),
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
      if (rotation.error) return fail("Credential rotation could not be prepared.", 409);
      await writeAuditEvent({ eventType: "managed_device_rotation_prepared", eventCategory: "security",
        targetType: "observer_site", targetId: principal.siteId,
        metadata: { deployment_profile: principal.profile, next_credential_version: nextVersion }, riskLevel: "high" });
      return ok({ rotation_id: rotationId, gateway_id: principal.deviceId,
        new_credential_version: nextVersion, challenge, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
    }

    if (payload.action === "rotate_confirm") {
      const rotation = await admin.from("observer_managed_device_rotations").select("id,enrollment_id,new_credential_version,challenge_hash,state,expires_at")
        .eq("id", payload.rotation_id).eq("new_credential_version", payload.new_credential_version)
        .in("state", ["PENDING", "CONFIRMED"]).maybeSingle();
      if (rotation.error || !rotation.data) return fail("Credential rotation proof expired or was reused.", 401);
      const enrollment = await admin.from("video_gateway_device_enrollments").select("id,gateway_id,status,lifecycle_state")
        .eq("id", rotation.data.enrollment_id).eq("gateway_id", payload.gateway_id).maybeSingle();
      const pending = await admin.from("observer_managed_device_credentials").select("public_key_spki,credential_state")
        .eq("enrollment_id", rotation.data.enrollment_id).eq("credential_version", payload.new_credential_version)
        .in("credential_state", ["PENDING", "ACTIVE"]).maybeSingle();
      if (enrollment.error || pending.error || !enrollment.data || !pending.data || enrollment.data.status !== "delivered"
        || enrollment.data.lifecycle_state !== "ACTIVE" || !verifyRotationConfirmation({ deviceId: payload.gateway_id,
          credentialVersion: payload.new_credential_version, rotationId: payload.rotation_id,
          challenge: payload.challenge, signature: payload.signature, publicKeySpki: pending.data.public_key_spki })) {
        return fail("Replacement credential proof is invalid.", 401);
      }
      if (rotation.data.state === "CONFIRMED" && pending.data.credential_state === "ACTIVE") {
        return ok({ status: "ROTATED", credential_version: payload.new_credential_version,
          old_credential_retired: true, idempotent_recovery: true });
      }
      if (Date.parse(rotation.data.expires_at) <= Date.now()
        || rotation.data.challenge_hash !== createHash("sha256").update(payload.challenge).digest("hex")) {
        return fail("Credential rotation proof expired or was reused.", 401);
      }
      const confirmed = await admin.rpc("confirm_observer_managed_device_rotation", { p_rotation: payload.rotation_id,
        p_enrollment: rotation.data.enrollment_id, p_new_version: payload.new_credential_version,
        p_challenge_hash: rotation.data.challenge_hash });
      if (confirmed.error || confirmed.data !== true) return fail("Credential rotation was not completed.", 409);
      await writeAuditEvent({ eventType: "managed_device_rotation_confirmed", eventCategory: "security",
        targetType: "managed_device", targetId: payload.gateway_id,
        metadata: { credential_version: payload.new_credential_version, old_credential_retired: true }, riskLevel: "high" });
      return ok({ status: "ROTATED", credential_version: payload.new_credential_version, old_credential_retired: true });
    }

    assertTrustedMutationOrigin(request);
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות.", 401);
    const site = await getObserverSiteAccess(session.supabase, session.profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לנהל את המכשיר באתר הזה.", 403);

    if (payload.action === "legacy_migration_prepare") {
      const legacy = await admin.from("video_gateway_device_enrollments")
        .select("id,gateway_id,identity_scheme,credential_version,status,lifecycle_state")
        .eq("gateway_id", payload.gateway_id).eq("observer_site_id", site.id).maybeSingle();
      if (legacy.error || !legacy.data || legacy.data.identity_scheme !== "LEGACY_HMAC"
        || legacy.data.credential_version !== 0 || legacy.data.status !== "delivered"
        || legacy.data.lifecycle_state !== "ACTIVE") {
        return fail("Legacy device is not eligible for controlled migration.", 409);
      }
      const existing = await admin.from("observer_managed_device_credentials").select("id")
        .eq("enrollment_id", legacy.data.id).in("credential_state", ["PENDING", "ACTIVE"]).maybeSingle();
      if (existing.error || existing.data) return fail("A device identity migration is already pending.", 409);
      const rotationId = randomUUID(), challenge = randomBytes(32).toString("base64url");
      const credential = await admin.from("observer_managed_device_credentials").insert({ id: randomUUID(),
        enrollment_id: legacy.data.id, credential_version: 1, algorithm: "Ed25519",
        public_key_spki: payload.new_public_key_spki, credential_state: "PENDING" });
      if (credential.error) return fail("Device identity migration could not be prepared.", 409);
      const rotation = await admin.from("observer_managed_device_rotations").insert({ id: rotationId,
        enrollment_id: legacy.data.id, old_credential_version: 0, new_credential_version: 1,
        challenge_hash: createHash("sha256").update(challenge).digest("hex"),
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
      if (rotation.error) return fail("Device identity migration could not be prepared.", 409);
      await writeAuditEvent({ eventType: "managed_device_legacy_migration_prepared", eventCategory: "security",
        actorProfileId: session.profile.id, targetType: "observer_site", targetId: site.id,
        metadata: { current_identity: "LEGACY_HMAC", target_identity: "ED25519_V1" }, riskLevel: "high" });
      return ok({ status: "MIGRATION_PREPARED", rotation_id: rotationId, gateway_id: payload.gateway_id,
        new_credential_version: 1, challenge, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
    }

    if (payload.action === "replace") {
      if (payload.old_gateway_id === payload.new_gateway_id) return fail("Replacement requires a new device identity.", 409);
      const replaced = await admin.rpc("replace_observer_managed_device", { p_site: site.id,
        p_old_gateway: payload.old_gateway_id, p_new_gateway: payload.new_gateway_id,
        p_actor: session.profile.id });
      if (replaced.error) return fail("Device replacement could not be completed safely.", 409);
      await writeAuditEvent({ eventType: "managed_device_replaced", eventCategory: "security",
        actorProfileId: session.profile.id, targetType: "observer_site", targetId: site.id,
        metadata: { source_count: replaced.data?.source_count ?? 0, old_device_retired: true }, riskLevel: "high" });
      return ok({ status: "REPLACED", ...replaced.data });
    }

    const enrollment = await admin.from("video_gateway_device_enrollments").update({ status: "revoked",
      lifecycle_state: payload.state, revocation_reason: payload.reason, revoked_at: new Date().toISOString(),
      refresh_token_hash: null, updated_at: new Date().toISOString() })
      .eq("gateway_id", payload.gateway_id).eq("observer_site_id", site.id).in("status", ["approved", "delivered"])
      .select("id").maybeSingle();
    if (enrollment.error || !enrollment.data) return fail("המכשיר לא נמצא או שכבר הוצא משימוש.", 404);
    await admin.from("observer_managed_device_credentials").update({ credential_state: "REVOKED", revoked_at: new Date().toISOString() })
      .eq("enrollment_id", enrollment.data.id).in("credential_state", ["PENDING", "ACTIVE"]);
    await admin.rpc("mark_observer_managed_device_unavailable", { p_site: site.id,
      p_gateway: payload.gateway_id, p_state: payload.state });
    await writeAuditEvent({ eventType: `managed_device_${payload.state.toLowerCase()}`, eventCategory: "security",
      actorProfileId: session.profile.id, targetType: "observer_site", targetId: site.id,
      metadata: { lifecycle_state: payload.state, reason_category: "AUTHORIZED_LIFECYCLE_CHANGE" }, riskLevel: "high" });
    return ok({ status: payload.state, monitoring_state: "ACTION_REQUIRED" });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
