/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 19 migration-backed update tables await generated types. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { gatewayDeviceSessionAllows, verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBoundedJson } from "@/lib/security/request-guards";
import { evaluateEdgeUpdateEligibility, verifyEdgeUpdateManifest, shouldPauseRollout } from "../../../../services/video-gateway/edge-update-contract.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const querySchema = z.object({ platform: z.string().regex(/^[a-z0-9-]{3,40}$/), architecture: z.enum(["arm64","x64"]),
  profile: z.enum(["SOFTWARE_CONNECTOR","PHYSICAL_GATEWAY","ENTERPRISE_EDGE"]), current_version: z.string().max(80),
  config_version: z.coerce.number().int().positive(), channel: z.enum(["INTERNAL","CANARY","STABLE"]) }).strict();
const statusSchema = z.object({ release_id: z.string().regex(/^[A-Za-z0-9._:-]{3,160}$/),
  state: z.enum(["UPDATE_AVAILABLE","DOWNLOADING","VERIFYING","STAGED","INSTALLING","RESTARTING","VERIFYING_HEALTH","HEALTHY","ROLLBACK_REQUIRED","ROLLING_BACK","ROLLED_BACK","UPDATE_FAILED"]),
  current_version: z.string().min(1).max(80), known_good_version: z.string().min(1).max(80),
  failure_category: z.string().regex(/^[A-Z0-9_:-]{3,100}$/).nullable() }).strict();

function secret() { return process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || ""; }
function trustedKeys() { try { const value = JSON.parse(process.env.OBSERVER_EDGE_RELEASE_PUBLIC_KEYS_JSON || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function response(data: unknown) { return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } }); }

async function authorize(request: Request, operation: "UPDATE_READ" | "UPDATE_STATUS") {
  const claims = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret());
  if (!claims || !gatewayDeviceSessionAllows(claims, operation) || claims.version !== 2) return null;
  const admin = createAdminClient() as any;
  const enrollment = await admin.from("video_gateway_device_enrollments")
    .select("id,status,lifecycle_state,observer_site_id,gateway_id,deployment_profile,credential_version,config_version")
    .eq("id", claims.device_id).eq("observer_site_id", claims.observer_site_id).eq("gateway_id", claims.gateway_id).maybeSingle();
  if (enrollment.error || !enrollment.data || enrollment.data.status !== "delivered" || enrollment.data.lifecycle_state !== "ACTIVE"
    || enrollment.data.deployment_profile !== claims.deployment_profile || enrollment.data.credential_version !== claims.credential_version) return null;
  return { claims, enrollment: enrollment.data, admin };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request, "UPDATE_READ"); if (!auth) return fail("Managed device update authentication failed.", 401);
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (query.profile !== auth.claims.deployment_profile) return fail("Managed device update scope mismatch.", 403);
    const rollout = await auth.admin.from("observer_edge_rollouts").select("id,stage,status,cohort_percent,release_id")
      .eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(20);
    if (rollout.error) throw new Error("EDGE_UPDATE_ROLLOUT_READ_FAILED");
    if (!rollout.data?.length) return response({ manifest: null, reason: "NO_ACTIVE_ROLLOUT" });
    for (const candidate of rollout.data) {
      const release = await auth.admin.from("observer_edge_releases").select("id,signed_manifest,release_state")
        .eq("id", candidate.release_id).eq("release_state", "PUBLISHED").maybeSingle();
      if (release.error) throw new Error("EDGE_UPDATE_RELEASE_READ_FAILED");
      if (!release.data) continue;
      const verified = verifyEdgeUpdateManifest(release.data.signed_manifest, trustedKeys());
      if (!verified.ok) continue;
      const eligible = evaluateEdgeUpdateEligibility(verified.manifest, { deviceId: auth.enrollment.id, profile: query.profile,
        platform: query.platform, architecture: query.architecture, currentVersion: query.current_version,
        configVersion: query.config_version, channel: query.channel, revoked: false });
      if (eligible.eligible) return response({ manifest: verified.manifest, rollout_id: candidate.id });
    }
    return response({ manifest: null, reason: "NO_ELIGIBLE_RELEASE" });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request, "UPDATE_STATUS"); if (!auth) return fail("Managed device update authentication failed.", 401);
    const payload = statusSchema.parse(await parseBoundedJson(request, 4096));
    const release = await auth.admin.from("observer_edge_releases").select("id,version").eq("release_id", payload.release_id).maybeSingle();
    if (release.error || !release.data) return fail("Unknown edge release.", 404);
    const rollout = await auth.admin.from("observer_edge_rollouts").select("id,stage,status,attempted_count,healthy_count,failed_count,rollback_count,canary_failure_threshold")
      .eq("release_id", release.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const previous = await auth.admin.from("observer_edge_device_updates").select("state").eq("enrollment_id", auth.enrollment.id)
      .eq("release_id", release.data.id).maybeSingle();
    if (previous.error) throw new Error("EDGE_UPDATE_STATUS_READ_FAILED");
    const write = await auth.admin.from("observer_edge_device_updates").upsert({ enrollment_id: auth.enrollment.id, release_id: release.data.id,
      rollout_id: rollout.data?.id ?? null, state: payload.state, current_version: payload.current_version,
      target_version: release.data.version, known_good_version: payload.known_good_version, failure_category: payload.failure_category,
      last_seen_at: new Date().toISOString(), safe_metadata: { deployment_profile: auth.claims.deployment_profile } }, { onConflict: "enrollment_id,release_id" });
    if (write.error) throw new Error("EDGE_UPDATE_STATUS_WRITE_FAILED");
    const firstTerminalReport = !["HEALTHY","ROLLED_BACK","UPDATE_FAILED"].includes(previous.data?.state || "")
      && ["HEALTHY","ROLLED_BACK","UPDATE_FAILED"].includes(payload.state);
    if (rollout.data && firstTerminalReport && payload.state === "HEALTHY") {
      await auth.admin.from("observer_edge_rollouts").update({ attempted_count: rollout.data.attempted_count + 1,
        healthy_count: rollout.data.healthy_count + 1, updated_at: new Date().toISOString() }).eq("id", rollout.data.id);
    }
    if (rollout.data && firstTerminalReport && rollout.data.stage === "CANARY" && ["ROLLED_BACK","UPDATE_FAILED"].includes(payload.state)) {
      const failed = rollout.data.failed_count + 1;
      const pause = shouldPauseRollout({ failedCanaries: failed, unhealthyCanaries: 0, failureThreshold: rollout.data.canary_failure_threshold });
      await auth.admin.from("observer_edge_rollouts").update({ attempted_count: rollout.data.attempted_count + 1, failed_count: failed,
        rollback_count: rollout.data.rollback_count + (payload.state === "ROLLED_BACK" ? 1 : 0),
        status: pause ? "PAUSED" : rollout.data.status, paused_reason: pause ? "CANARY_HEALTH_GATE_FAILED" : null,
        updated_at: new Date().toISOString() }).eq("id", rollout.data.id);
    }
    return response({ accepted: true });
  } catch (error) { return handleSafeRouteError(error); }
}
