/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types intentionally lag this new migration. */
import { createHash } from "node:crypto";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import {
  managedDeviceOperationAllowed,
  managedDeviceProofFromHeaders,
  managedDeviceProfiles,
  type ManagedDeviceOperation,
  type ManagedDevicePrincipal,
  verifyManagedDeviceProof
} from "./managed-device-identity";

type AuthenticatedManagedDevice = {
  principal: ManagedDevicePrincipal;
  authMode: "ED25519_V1" | "LEGACY_HMAC";
  sessionClass: "FIRST_SEEN" | "CONTINUATION" | "RESTART" | "LEGACY";
};

function profileOf(value: unknown) {
  return managedDeviceProfiles.includes(value as any) ? value as ManagedDevicePrincipal["profile"] : null;
}

function principalFromEnrollment(row: any): ManagedDevicePrincipal | null {
  const profile = profileOf(row.deployment_profile ?? row.metadata?.device_type);
  if (!row.id || !row.gateway_id || !row.observer_site_id || !profile) return null;
  return {
    deviceId: row.gateway_id,
    enrollmentId: row.id,
    tenantId: row.tenant_id ?? null,
    siteId: row.observer_site_id,
    profile,
    credentialVersion: Number(row.credential_version || 0),
    runtimeVersion: row.runtime_version ?? row.metadata?.software_version ?? null,
    configVersion: Number(row.config_version || row.metadata?.connector_config_version || 1),
    enrollmentState: row.identity_scheme === "ED25519_V1" ? "HARDENED" : "LEGACY",
    lifecycleState: row.lifecycle_state ?? (row.status === "revoked" ? "REVOKED" : "ACTIVE"),
    lastSeenAt: row.last_seen_at ?? row.metadata?.last_heartbeat_at ?? null
  };
}

export async function authenticateManagedDeviceRequest(input: {
  request: Request;
  admin: any;
  operation: ManagedDeviceOperation;
  bodyText?: string;
  legacySecret?: string;
  now?: number;
}): Promise<AuthenticatedManagedDevice | null> {
  const proof = managedDeviceProofFromHeaders(input.request.headers);
  if (proof) {
    const enrollmentResult = await input.admin.from("video_gateway_device_enrollments").select(
      "id,gateway_id,observer_site_id,tenant_id,status,identity_scheme,deployment_profile,credential_version,lifecycle_state,runtime_version,config_version,last_seen_at,metadata"
    ).eq("gateway_id", proof.deviceId).maybeSingle();
    const row = enrollmentResult.data;
    if (enrollmentResult.error || !row || row.identity_scheme !== "ED25519_V1" || row.status !== "delivered" || row.lifecycle_state !== "ACTIVE") return null;
    const principal = principalFromEnrollment(row);
    if (!principal || !principal.tenantId || principal.credentialVersion !== proof.credentialVersion
      || !managedDeviceOperationAllowed(principal.profile, input.operation)) return null;
    const credential = await input.admin.from("observer_managed_device_credentials")
      .select("public_key_spki,credential_state").eq("enrollment_id", row.id)
      .eq("credential_version", proof.credentialVersion).eq("credential_state", "ACTIVE").maybeSingle();
    if (credential.error || !credential.data) return null;
    const url = new URL(input.request.url);
    const body = input.bodyText ?? (input.request.method === "GET" || input.request.method === "HEAD" ? "" : await input.request.clone().text());
    const verified = verifyManagedDeviceProof({ proof, method: input.request.method, pathname: url.pathname,
      body, publicKeySpki: credential.data.public_key_spki, now: input.now });
    if (!verified.ok) return null;
    const recorded = await input.admin.rpc("record_observer_managed_device_auth", {
      p_enrollment: row.id,
      p_credential_version: proof.credentialVersion,
      p_nonce_hash: createHash("sha256").update(proof.nonce).digest("hex"),
      p_runtime_instance: proof.runtimeInstanceId,
      p_sequence: proof.sequence,
      p_observed_at: proof.timestamp
    });
    if (recorded.error || !["FIRST_SEEN", "CONTINUATION", "RESTART"].includes(recorded.data)) return null;
    return { principal: { ...principal, lastSeenAt: proof.timestamp }, authMode: "ED25519_V1", sessionClass: recorded.data };
  }

  if (!input.legacySecret) return null;
  const legacyClaims = verifyGatewayDeviceAccessToken(input.request.headers.get("x-video-gateway-device-token") || "", input.legacySecret);
  if (!legacyClaims) return null;
  const enrollment = await input.admin.from("video_gateway_device_enrollments").select(
    "id,gateway_id,observer_site_id,tenant_id,status,identity_scheme,deployment_profile,credential_version,lifecycle_state,runtime_version,config_version,last_seen_at,metadata"
  ).eq("id", legacyClaims.device_id).eq("gateway_id", legacyClaims.gateway_id)
    .eq("observer_site_id", legacyClaims.observer_site_id).eq("status", "delivered").maybeSingle();
  if (enrollment.error || !enrollment.data || ![null, undefined, "LEGACY_HMAC"].includes(enrollment.data.identity_scheme)) return null;
  const principal = principalFromEnrollment(enrollment.data);
  if (!principal || !managedDeviceOperationAllowed(principal.profile, input.operation)) return null;
  return { principal, authMode: "LEGACY_HMAC", sessionClass: "LEGACY" };
}
