/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 38P release-delivery tables await generated types. */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { gatewayDeviceSessionAllows, verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBoundedJson } from "@/lib/security/request-guards";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertAuthorizedUpdateDirection, compareSemanticVersions, evaluateEdgeUpdateEligibility, verifyEdgeUpdateManifest } from "../../../../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseScopeAllows } from "../../../../../services/video-gateway/edge-release-object.mjs";
import { authorizeHomeQaR2Download } from "../../../../../services/video-gateway/edge-r2-download.mjs";
import { homeQaManagedPhaseAllows } from "../../../../../services/video-gateway/home-qa-transition-phase.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ release_id: z.string().regex(/^[A-Za-z0-9._:-]{3,160}$/),
  platform: z.string().regex(/^[a-z0-9-]{3,40}$/), architecture: z.enum(["arm64", "x64"]),
  profile: z.enum(["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"]),
  channel: z.literal("HOME_QA"), current_version: z.string().max(80),
  config_version: z.number().int().positive() }).strict();
const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function trustedKeys() {
  try { const value = JSON.parse(process.env.OBSERVER_EDGE_RELEASE_PUBLIC_KEYS_JSON || "{}");
    const revoked = JSON.parse(process.env.OBSERVER_EDGE_RELEASE_REVOKED_KEY_IDS_JSON || "[]");
    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(revoked)) return {};
    for (const keyId of revoked) if (typeof keyId === "string") delete value[keyId];
    return value; }
  catch { return {}; }
}

export async function POST(request: Request) {
  try {
    const claims = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "",
      process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "");
    if (!claims || claims.version !== 2 || !gatewayDeviceSessionAllows(claims, "UPDATE_READ"))
      return fail("Managed device release authentication failed.", 401);
    // Do not reveal delivery readiness to an unauthenticated caller. Even an
    // authenticated device is denied until the isolated rollout is enabled.
    if (process.env.OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY !== "enabled")
      return fail("Private edge release delivery is not active.", 503);
    const input = requestSchema.parse(await parseBoundedJson(request, 2048));
    if (input.profile !== claims.deployment_profile) return fail("Release scope mismatch.", 403);
    const admin = createAdminClient() as any;
    const enrollment = await admin.from("video_gateway_device_enrollments")
      .select("id,status,lifecycle_state,observer_site_id,gateway_id,deployment_profile,credential_version,config_version,revoked_at,identity_scheme,metadata")
      .eq("id", claims.device_id).eq("observer_site_id", claims.observer_site_id)
      .eq("gateway_id", claims.gateway_id).maybeSingle();
    if (enrollment.error || !enrollment.data || enrollment.data.status !== "delivered" ||
      enrollment.data.lifecycle_state !== "ACTIVE" || enrollment.data.deployment_profile !== claims.deployment_profile ||
      enrollment.data.credential_version !== claims.credential_version || enrollment.data.revoked_at ||
      enrollment.data.config_version !== input.config_version)
      return fail("Managed device release authentication failed.", 401);
    const release = await admin.from("observer_edge_releases")
      .select("id,release_id,release_state,signed_manifest,artifact_sha256,version,channel,platform,architecture,deployment_profile,signing_key_id")
      .eq("release_id", input.release_id).eq("release_state", "PUBLISHED").maybeSingle();
    if (release.error || !release.data) return fail("Release unavailable.", 404);
    const rollout = await admin.from("observer_edge_rollouts").select("id,stage,status,cohort_percent")
      .eq("release_id", release.data.id).eq("status", "ACTIVE")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rollout.error || !rollout.data) return fail("Release unavailable.", 404);
    const verified = verifyEdgeUpdateManifest(release.data.signed_manifest, trustedKeys());
    if (!verified.ok) return fail("Release unavailable.", 404);
    const manifest = verified.manifest;
    if (!homeQaManagedPhaseAllows({ enrollment: enrollment.data, manifest }))
      return fail("Release unavailable.", 404);
    if (manifest.release_id !== release.data.release_id || manifest.artifact_sha256 !== release.data.artifact_sha256 ||
      manifest.version !== release.data.version || manifest.channel !== release.data.channel ||
      manifest.platform !== release.data.platform || manifest.architecture !== release.data.architecture ||
      manifest.profile !== release.data.deployment_profile || manifest.signing_key_id !== release.data.signing_key_id ||
      manifest.channel !== "HOME_QA" || manifest.rollout.stage !== rollout.data.stage ||
      manifest.rollout.cohort_percent !== rollout.data.cohort_percent ||
      rollout.data.stage !== "INTERNAL_QA" || rollout.data.cohort_percent !== 0)
      return fail("Release unavailable.", 404);
    const lastHealthy = await admin.from("observer_edge_device_updates").select("current_version")
      .eq("enrollment_id", enrollment.data.id).eq("state", "HEALTHY")
      .order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
    if (lastHealthy.error) return fail("Release state unavailable.", 503);
    if (lastHealthy.data && compareSemanticVersions(input.current_version, lastHealthy.data.current_version) < 0)
      return fail("Release unavailable.", 404);
    try { assertAuthorizedUpdateDirection({ currentVersion: input.current_version, targetVersion: manifest.version,
      knownGoodVersions: [], securityFloorVersion: manifest.compatibility.security_floor_version, rollback: false }); }
    catch { return fail("Release unavailable.", 404); }
    const device = { deviceId: enrollment.data.gateway_id, profile: input.profile, platform: input.platform,
      architecture: input.architecture, channel: input.channel, currentVersion: input.current_version,
      configVersion: input.config_version, revoked: false };
    if (!edgeReleaseScopeAllows(manifest, device) || !evaluateEdgeUpdateEligibility(manifest, device).eligible)
      return fail("Release unavailable.", 404);
    const accountId = process.env.OBSERVER_EDGE_R2_ACCOUNT_ID || "";
    assertEdgeReleaseObjectUrl(manifest, `https://${accountId}.r2.cloudflarestorage.com`);
    const identifier = createHash("sha256").update(`edge-release:${enrollment.data.id}`).digest("hex");
    await assertRateLimit(identifier, "observer_edge_release_download", 4, 300);
    const grant = await authorizeHomeQaR2Download(manifest, { accountId,
      accessKeyId: process.env.OBSERVER_EDGE_R2_READ_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.OBSERVER_EDGE_R2_READ_SECRET_ACCESS_KEY || "" });
    const audit = await admin.from("observer_edge_release_download_authorizations").insert({
      enrollment_id: enrollment.data.id, release_id: release.data.id,
      outcome: "ISSUED", artifact_size: manifest.artifact_size, artifact_sha256: manifest.artifact_sha256
    });
    if (audit.error) return fail("Release authorization audit unavailable.", 503);
    return NextResponse.json({ data: { release_id: manifest.release_id, artifact_sha256: manifest.artifact_sha256,
      artifact_size: manifest.artifact_size, url: grant.url, expires_at: grant.expires_at } },
    { headers: responseHeaders });
  } catch (error) { return handleSafeRouteError(error); }
}
