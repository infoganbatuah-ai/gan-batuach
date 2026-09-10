/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 19 migration-backed release tables await generated types. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { verifyEdgeUpdateManifest, shouldPauseRollout } from "../../../../../services/video-gateway/edge-update-contract.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), manifest: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.literal("create_rollout"), release_id: z.string().uuid(), stage: z.enum(["INTERNAL_QA","CANARY","SMALL_COHORT","BROADER_COHORT","GENERAL"]), cohort_percent: z.number().int().min(0).max(100), canary_failure_threshold: z.number().int().min(1).max(100), target_filters: z.record(z.string(), z.unknown()).default({}) }).strict(),
  z.object({ action: z.enum(["pause_rollout","advance_rollout"]), rollout_id: z.string().uuid() }).strict(),
  z.object({ action: z.enum(["retire_release","disable_release"]), release_id: z.string().uuid() }).strict()
]);

function trustedKeys(): Record<string, string> {
  try {
    const value = JSON.parse(process.env.OBSERVER_EDGE_RELEASE_PUBLIC_KEYS_JSON || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => /^[A-Za-z0-9._:-]{3,160}$/.test(entry[0]) && typeof entry[1] === "string"));
  } catch { return {}; }
}
function response(data: unknown) { return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } }); }

async function adminSession(request: Request) {
  const session = await getDigitalObserverApiUser(request);
  if (!session) return null;
  return hasObserverAdminClaim(session.user.app_metadata) ? session : null;
}

export async function GET(request: Request) {
  try {
    const session = await adminSession(request); if (!session) return fail("Observer release administration requires platform authorization.", 403);
    const admin = createAdminClient() as any;
    const [releases, rollouts] = await Promise.all([
      admin.from("observer_edge_releases").select("id,release_id,version,build_sha,channel,platform,architecture,deployment_profile,signing_key_id,release_state,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("observer_edge_rollouts").select("id,release_id,stage,status,cohort_percent,attempted_count,healthy_count,failed_count,rollback_count,paused_reason,created_at").order("created_at", { ascending: false }).limit(100)
    ]);
    if (releases.error || rollouts.error) throw new Error("EDGE_RELEASE_READ_FAILED");
    return response({ releases: releases.data, rollouts: rollouts.data });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const session = await adminSession(request); if (!session) return fail("Observer release administration requires platform authorization.", 403);
    await assertRateLimit(privateRateLimitIdentifier({ headers: request.headers, userId: session.profile.id }), "observer-edge-release-admin", 30, 60);
    const payload = requestSchema.parse(await parseBoundedJson(request, 32 * 1024));
    const admin = createAdminClient() as any;
    let result: any;
    if (payload.action === "publish") {
      const verified = verifyEdgeUpdateManifest(payload.manifest, trustedKeys());
      if (!verified.ok) return fail(`Release rejected: ${verified.reason}`, 422);
      const m = verified.manifest;
      result = await admin.from("observer_edge_releases").insert({ release_id: m.release_id, version: m.version, build_sha: m.build_sha,
        channel: m.channel, platform: m.platform, architecture: m.architecture, deployment_profile: m.profile,
        signed_manifest: m, artifact_sha256: m.artifact_sha256, signing_key_id: m.signing_key_id, created_by: session.profile.id }).select("id,release_id,version,release_state").single();
    } else if (payload.action === "create_rollout") {
      result = await admin.from("observer_edge_rollouts").insert({ release_id: payload.release_id, stage: payload.stage, status: "ACTIVE",
        cohort_percent: payload.cohort_percent, canary_failure_threshold: payload.canary_failure_threshold,
        target_filters: payload.target_filters, created_by: session.profile.id }).select("id,stage,status").single();
    } else if (payload.action === "pause_rollout") {
      result = await admin.from("observer_edge_rollouts").update({ status: "PAUSED", paused_reason: "ADMIN_PAUSED", updated_at: new Date().toISOString() }).eq("id", payload.rollout_id).select("id,status").single();
    } else if (payload.action === "advance_rollout") {
      const current = await admin.from("observer_edge_rollouts").select("id,stage,failed_count,canary_failure_threshold").eq("id", payload.rollout_id).single();
      if (current.error || !current.data) return fail("Rollout not found.", 404);
      if (current.data.stage === "CANARY" && shouldPauseRollout({ failedCanaries: current.data.failed_count, unhealthyCanaries: 0, failureThreshold: current.data.canary_failure_threshold })) {
        result = await admin.from("observer_edge_rollouts").update({ status: "PAUSED", paused_reason: "CANARY_HEALTH_GATE_FAILED", updated_at: new Date().toISOString() }).eq("id", payload.rollout_id).select("id,status,paused_reason").single();
      } else {
        const stages = ["INTERNAL_QA","CANARY","SMALL_COHORT","BROADER_COHORT","GENERAL"];
        const next = stages[Math.min(stages.length - 1, stages.indexOf(current.data.stage) + 1)];
        result = await admin.from("observer_edge_rollouts").update({ stage: next, status: "ACTIVE", updated_at: new Date().toISOString() }).eq("id", payload.rollout_id).select("id,stage,status").single();
      }
    } else if (payload.action === "retire_release" || payload.action === "disable_release") {
      result = await admin.from("observer_edge_releases").update({ release_state: payload.action === "disable_release" ? "DISABLED" : "RETIRED", updated_at: new Date().toISOString() }).eq("id", payload.release_id).select("id,release_state").single();
    } else throw new Error("EDGE_RELEASE_ACTION_UNSUPPORTED");
    if (result.error) throw new Error("EDGE_RELEASE_MUTATION_FAILED");
    await writeAuditEvent({ eventType: `edge_release_${payload.action}`, eventCategory: "security", actorProfileId: session.profile.id,
      actorRole: session.profile.role, targetType: "observer_edge_release", targetId: "release_id" in payload ? payload.release_id : "rollout_id" in payload ? payload.rollout_id : null,
      metadata: { action: payload.action }, riskLevel: "high" });
    return response(result.data);
  } catch (error) { return handleSafeRouteError(error); }
}
