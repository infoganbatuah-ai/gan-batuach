/* eslint-disable @typescript-eslint/no-explicit-any -- The isolated PUSH 38 QA schema is ahead of generated Supabase types. */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBoundedJson } from "@/lib/security/request-guards";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { verifyEdgeUpdateManifest } from "../../../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseScopeAllows } from "../../../../services/video-gateway/edge-release-object.mjs";
import { authorizeHomeQaR2Download } from "../../../../services/video-gateway/edge-r2-download.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../../../services/video-gateway/edge-release-trust.mjs";
import { verifyHomeQaLegacyProof } from "../../../../services/video-gateway/home-qa-legacy-proof.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const connectorTransition = "qa-connector-legacy-transition-v2-6e7988808b05";
const gatewayRelease = "qa-p38-health-gateway-6c9d08327ec6";
const requestSchema = z.object({
  device_id: z.string().uuid(), enrollment_id: z.string().uuid(),
  site_id: z.string().uuid(), tenant_id: z.string().uuid(),
  profile: z.enum(["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"]),
  platform: z.literal("darwin"), architecture: z.literal("arm64"), channel: z.literal("HOME_QA"),
  current_version: z.literal("0.1.0-legacy"), config_version: z.number().int().positive(),
  release_id: z.string().regex(/^[A-Za-z0-9._:-]{3,160}$/),
  timestamp: z.string().datetime(), nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
}).strict();
const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function legacyAuthDeny(reason: string) {
  console.warn(JSON.stringify({ level: "warn", domain: "push38_home_qa_legacy_auth",
    outcome: "DENY", reason }));
  return fail("Legacy qualification authentication failed.", 401);
}

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== "development" || process.env.OBSERVER_PUSH38_QUALIFICATION !== "enabled" ||
      process.env.OBSERVER_HOME_QA_LEGACY_TRANSITION !== "enabled" ||
      process.env.OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY !== "enabled")
      return fail("Qualification transition delivery is unavailable.", 404);
    const signature = request.headers.get("x-observer-home-qa-legacy-signature") || "";
    if (!signature) return legacyAuthDeny("SIGNATURE_HEADER_MISSING");
    const input = requestSchema.parse(await parseBoundedJson(request, 2048));
    const expectedRelease = input.profile === "SOFTWARE_CONNECTOR" ? connectorTransition : gatewayRelease;
    if (input.release_id !== expectedRelease) return fail("Release unavailable.", 404);
    const admin = createAdminClient() as any;
    const enrollment = await admin.from("video_gateway_device_enrollments")
      .select("id,gateway_id,observer_site_id,tenant_id,deployment_profile,status,lifecycle_state,identity_scheme,credential_version,config_version,expires_at,metadata,revoked_at")
      .eq("id", input.enrollment_id).eq("gateway_id", input.device_id)
      .eq("observer_site_id", input.site_id).eq("tenant_id", input.tenant_id).maybeSingle();
    if (enrollment.error || !enrollment.data) return legacyAuthDeny("EXACT_ENROLLMENT_NOT_FOUND");
    const row = enrollment.data;
    const enrollmentExpiresAt = Date.parse(row.expires_at || "");
    const proofExpiresAt = Date.parse(row.metadata?.home_qa_legacy_proof_expires_at || "");
    if (row.status !== "pending" || row.lifecycle_state !== "ACTIVE" || row.revoked_at ||
      row.identity_scheme !== "LEGACY_HMAC" || row.credential_version !== 0 ||
      row.deployment_profile !== input.profile || row.config_version !== input.config_version ||
      !Number.isFinite(enrollmentExpiresAt) || enrollmentExpiresAt <= Date.now() ||
      row.metadata?.qualification_only !== true ||
      row.metadata?.home_qa_phase !== "LEGACY_VERIFIED_FOR_TRANSITION" ||
      row.metadata?.product_enrollment_id !== input.enrollment_id ||
      !/^[a-f0-9]{64}$/.test(row.metadata?.authorized_baseline_sha256 || "") ||
      !/^[a-f0-9]{64}$/.test(row.metadata?.identity_evidence_sha256 || "") ||
      !Number.isFinite(proofExpiresAt) || proofExpiresAt <= Date.now())
      return legacyAuthDeny("ENROLLMENT_OR_PROOF_WINDOW_INVALID");
    if (!verifyHomeQaLegacyProof(input, signature, row.metadata.home_qa_legacy_public_key_spki))
      return legacyAuthDeny("SIGNATURE_VERIFICATION_FAILED");
    const release = await admin.from("observer_edge_releases")
      .select("id,release_id,release_state,signed_manifest,artifact_sha256,version,channel,platform,architecture,deployment_profile,signing_key_id")
      .eq("release_id", input.release_id).eq("release_state", "PUBLISHED").maybeSingle();
    if (release.error || !release.data) return fail("Release unavailable.", 404);
    const rollout = await admin.from("observer_edge_rollouts")
      .select("id,stage,status,cohort_percent,target_filters")
      .eq("release_id", release.data.id).eq("status", "ACTIVE").maybeSingle();
    if (rollout.error || !rollout.data || rollout.data.stage !== "INTERNAL_QA" ||
      rollout.data.cohort_percent !== 0 ||
      JSON.stringify(rollout.data.target_filters?.explicit_device_ids) !== JSON.stringify([input.device_id]))
      return fail("Release unavailable.", 404);
    const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
    const verified = verifyEdgeUpdateManifest(release.data.signed_manifest, keys);
    if (!verified.ok) return fail("Release unavailable.", 404);
    const manifest = verified.manifest;
    if (manifest.release_id !== release.data.release_id || manifest.artifact_sha256 !== release.data.artifact_sha256 ||
      manifest.version !== release.data.version || manifest.channel !== release.data.channel ||
      manifest.platform !== release.data.platform || manifest.architecture !== release.data.architecture ||
      manifest.profile !== release.data.deployment_profile || manifest.signing_key_id !== release.data.signing_key_id ||
      manifest.channel !== "HOME_QA" || manifest.profile !== input.profile ||
      manifest.platform !== input.platform || manifest.architecture !== input.architecture ||
      manifest.rollout.stage !== "INTERNAL_QA" || manifest.rollout.cohort_percent !== 0 ||
      JSON.stringify(manifest.rollout.explicit_device_ids) !== JSON.stringify([input.device_id]) ||
      !edgeReleaseScopeAllows(manifest, { deviceId: input.device_id, profile: input.profile,
        platform: input.platform, architecture: input.architecture, channel: input.channel }))
      return fail("Release unavailable.", 404);
    const accountId = process.env.OBSERVER_EDGE_R2_ACCOUNT_ID || "";
    assertEdgeReleaseObjectUrl(manifest, `https://${accountId}.r2.cloudflarestorage.com`);
    const identifier = createHash("sha256").update(`home-qa-legacy:${row.id}`).digest("hex");
    await assertRateLimit(identifier, "observer_edge_release_download", 4, 300);
    const nonceHash = createHash("sha256").update(input.nonce).digest("hex");
    const nonce = await admin.from("observer_managed_device_auth_nonces").insert({
      enrollment_id: row.id, credential_version: 0, nonce_hash: nonceHash,
      observed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 5 * 60_000).toISOString()
    });
    if (nonce.error) return legacyAuthDeny("NONCE_REPLAY_OR_AUDIT_UNAVAILABLE");
    const grant = await authorizeHomeQaR2Download(manifest, { accountId,
      accessKeyId: process.env.OBSERVER_EDGE_R2_READ_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.OBSERVER_EDGE_R2_READ_SECRET_ACCESS_KEY || "" });
    const audit = await admin.from("observer_edge_release_download_authorizations").insert({
      enrollment_id: row.id, release_id: release.data.id, outcome: "ISSUED",
      artifact_size: manifest.artifact_size, artifact_sha256: manifest.artifact_sha256
    });
    if (audit.error) return fail("Release authorization audit unavailable.", 503);
    return NextResponse.json({ data: { release_id: manifest.release_id,
      artifact_sha256: manifest.artifact_sha256, artifact_size: manifest.artifact_size,
      url: grant.url, expires_at: grant.expires_at,
      install_authorized: false, identity_phase: "LEGACY_VERIFIED_FOR_TRANSITION" } },
    { headers: responseHeaders });
  } catch (error) { return handleSafeRouteError(error); }
}
