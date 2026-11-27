/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 38P release-delivery tables await generated types. */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { gatewayDeviceSessionAllows, verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBoundedJson } from "@/lib/security/request-guards";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { evaluateEdgeUpdateEligibility, verifyEdgeUpdateManifest } from "../../../../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseScopeAllows, EDGE_RELEASE_BUCKET } from "../../../../../services/video-gateway/edge-release-object.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ release_id: z.string().regex(/^[A-Za-z0-9._:-]{3,160}$/),
  platform: z.string().regex(/^[a-z0-9-]{3,40}$/), architecture: z.enum(["arm64", "x64"]),
  profile: z.enum(["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"]),
  channel: z.enum(["INTERNAL", "CANARY", "STABLE"]), current_version: z.string().max(80),
  config_version: z.number().int().positive() }).strict();
const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function trustedKeys() {
  try { const value = JSON.parse(process.env.OBSERVER_EDGE_RELEASE_PUBLIC_KEYS_JSON || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}

export async function POST(request: Request) {
  try {
    // Cloud publication and the storage migration require a separately reviewed release.
    if (process.env.OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY !== "enabled")
      return fail("Private edge release delivery is not active.", 503);
    const claims = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "",
      process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "");
    if (!claims || claims.version !== 2 || !gatewayDeviceSessionAllows(claims, "UPDATE_READ"))
      return fail("Managed device release authentication failed.", 401);
    const input = requestSchema.parse(await parseBoundedJson(request, 2048));
    if (input.profile !== claims.deployment_profile) return fail("Release scope mismatch.", 403);
    const admin = createAdminClient() as any;
    const enrollment = await admin.from("video_gateway_device_enrollments")
      .select("id,status,lifecycle_state,observer_site_id,gateway_id,deployment_profile,credential_version")
      .eq("id", claims.device_id).eq("observer_site_id", claims.observer_site_id)
      .eq("gateway_id", claims.gateway_id).maybeSingle();
    if (enrollment.error || !enrollment.data || enrollment.data.status !== "delivered" ||
      enrollment.data.lifecycle_state !== "ACTIVE" || enrollment.data.deployment_profile !== claims.deployment_profile ||
      enrollment.data.credential_version !== claims.credential_version)
      return fail("Managed device release authentication failed.", 401);
    const release = await admin.from("observer_edge_releases")
      .select("id,release_id,release_state,signed_manifest,artifact_sha256")
      .eq("release_id", input.release_id).eq("release_state", "PUBLISHED").maybeSingle();
    if (release.error || !release.data) return fail("Release unavailable.", 404);
    const rollout = await admin.from("observer_edge_rollouts").select("id,stage,status")
      .eq("release_id", release.data.id).eq("status", "ACTIVE")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rollout.error || !rollout.data) return fail("Release unavailable.", 404);
    const verified = verifyEdgeUpdateManifest(release.data.signed_manifest, trustedKeys());
    if (!verified.ok) return fail("Release unavailable.", 404);
    const manifest = verified.manifest;
    if (manifest.release_id !== release.data.release_id || manifest.artifact_sha256 !== release.data.artifact_sha256 ||
      manifest.rollout.stage !== rollout.data.stage) return fail("Release unavailable.", 404);
    const device = { deviceId: enrollment.data.id, profile: input.profile, platform: input.platform,
      architecture: input.architecture, channel: input.channel, currentVersion: input.current_version,
      configVersion: input.config_version, revoked: false };
    if (!edgeReleaseScopeAllows(manifest, device) || !evaluateEdgeUpdateEligibility(manifest, device).eligible)
      return fail("Release unavailable.", 404);
    const objectPath = assertEdgeReleaseObjectUrl(manifest, process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    const identifier = createHash("sha256").update(`edge-release:${enrollment.data.id}`).digest("hex");
    await assertRateLimit(identifier, "observer_edge_release_download", 4, 300);
    const signed = await admin.storage.from(EDGE_RELEASE_BUCKET).createSignedUrl(objectPath, 120);
    if (signed.error || !signed.data?.signedUrl) return fail("Release artifact unavailable.", 503);
    const url = new URL(signed.data.signedUrl);
    if (url.protocol !== "https:" || url.origin !== new URL(manifest.artifact_url).origin ||
      !url.pathname.startsWith(`/storage/v1/object/sign/${EDGE_RELEASE_BUCKET}/`))
      return fail("Release artifact authorization invalid.", 503);
    const audit = await admin.from("observer_edge_release_download_authorizations").insert({
      enrollment_id: enrollment.data.id, release_id: release.data.id,
      outcome: "ISSUED", artifact_size: manifest.artifact_size, artifact_sha256: manifest.artifact_sha256
    });
    if (audit.error) return fail("Release authorization audit unavailable.", 503);
    return NextResponse.json({ data: { release_id: manifest.release_id, artifact_sha256: manifest.artifact_sha256,
      artifact_size: manifest.artifact_size, url: url.toString(), expires_at: new Date(Date.now() + 120_000).toISOString() } },
    { headers: responseHeaders });
  } catch (error) { return handleSafeRouteError(error); }
}
