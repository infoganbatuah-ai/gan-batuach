import { fail, handleRouteError, ok } from "@/lib/api";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cameraQueueKinds, cameraQueueRequestSchema, cameraQueueSelect, cameraQueueSourceSelect,
  PHYSICAL_RESULT_GRACE_MS,
  queueBindingMatches, queueResultDigest, queueTask, validateQueueResult,
  type CameraQueueRow, type QueueSource
} from "@/lib/domain/digital-observer/camera-queue-contract";

export const runtime = "nodejs";

async function authenticatedDevice(request: Request) {
  const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  const token = request.headers.get("x-video-gateway-device-token")?.trim() ?? "";
  if (!secret || !token) return null;
  const claims = verifyGatewayDeviceAccessToken(token, secret);
  if (!claims) return null;
  const supabase = createAdminClient();
  const enrollment = await supabase.from("video_gateway_device_enrollments").select("id")
    .eq("id", claims.device_id).eq("gateway_id", claims.gateway_id)
    .eq("observer_site_id", claims.observer_site_id).eq("status", "delivered").maybeSingle();
  if (enrollment.error) throw new Error("CAMERA_QUEUE_DATABASE_UNAVAILABLE");
  return enrollment.data ? { claims, supabase } : null;
}

type JoinedRow = CameraQueueRow & { source: QueueSource };
const terminalStatuses = ["completed", "failed", "reconciliation_required", "unknown"] as const;

function persistedTerminal(payload: ReturnType<typeof cameraQueueRequestSchema.parse>) {
  if (payload.action === "poll") throw new Error("CAMERA_QUEUE_RESULT_REQUIRED");
  if (payload.outcome === "acknowledged_needs_reconciliation") {
    return { action_status: "reconciliation_required", non_retryable: true, result_phase: payload.outcome_payload.phase };
  }
  if (payload.outcome === "unknown_non_retryable") {
    return { action_status: "unknown", non_retryable: true, result_phase: payload.outcome_payload.phase };
  }
  if (payload.outcome === "physical_command") return { action_status: "completed", non_retryable: true, result_phase: null };
  return { action_status: payload.outcome === "failed" ? "failed" : "completed",
    non_retryable: false, result_phase: null };
}

export async function POST(request: Request) {
  try {
    const device = await authenticatedDevice(request);
    if (!device) return fail("Gateway device authentication failed.", 401);
    const payload = cameraQueueRequestSchema.parse(await request.json());
    const { claims, supabase } = device;
    const scopedQueue = () => supabase.from("digital_observer_camera_action_requests")
      .select(`${cameraQueueSelect},${cameraQueueSourceSelect}`)
      .eq("observer_site_id", claims.observer_site_id).eq("gateway_id", claims.gateway_id);

    if (payload.action === "poll") {
      const now = new Date().toISOString();
      const expired = await supabase.from("digital_observer_camera_action_requests")
        .update({ action_status: "expired", updated_at: now })
        .eq("observer_site_id", claims.observer_site_id).eq("gateway_id", claims.gateway_id)
        .in("task_kind", cameraQueueKinds).eq("action_status", "approved").lte("expires_at", now);
      if (expired.error) return fail("Camera queue is unavailable.", 503);

      // Postgres filters by tenant and Gateway BEFORE LIMIT. The join removes
      // per-row lookups; legacy physical commands are not reinterpreted.
      const candidates = await scopedQueue().in("task_kind", cameraQueueKinds)
        .eq("action_status", "approved").gt("expires_at", now)
        .order("created_at").order("id").limit(25);
      if (candidates.error) return fail("Camera queue is unavailable.", 503);
      for (const row of (candidates.data ?? []) as unknown as JoinedRow[]) {
        let task;
        try {
          if (!queueBindingMatches(row, row.source, claims)) throw new Error("CAMERA_QUEUE_BINDING_CHANGED");
          task = queueTask(row);
        } catch {
          const blocked = await supabase.from("digital_observer_camera_action_requests")
            .update({ action_status: "blocked", updated_at: now, result: { code: "binding_or_contract_invalid", executed: false } })
            .eq("id", row.id).eq("observer_site_id", claims.observer_site_id).eq("gateway_id", claims.gateway_id).eq("action_status", "approved");
          if (blocked.error) return fail("Camera queue is unavailable.", 503);
          continue;
        }
        const deliveredAt = new Date().toISOString();
        const delivered = await supabase.from("digital_observer_camera_action_requests")
          .update({ action_status: "delivered", delivered_at: deliveredAt, updated_at: deliveredAt })
          .eq("id", row.id).eq("observer_site_id", claims.observer_site_id).eq("gateway_id", claims.gateway_id)
          .eq("action_status", "approved").gt("expires_at", deliveredAt).select("id").maybeSingle();
        if (delivered.error) return fail("Camera queue delivery could not be recorded.", 503);
        if (delivered.data) return ok({ action_request: task });
      }
      return ok({ action_request: null });
    }

    const legacyResult = () => supabase.from("digital_observer_camera_action_requests")
      .select(`${cameraQueueSelect},${cameraQueueSourceSelect}`).eq("id", payload.request_id)
      .eq("observer_site_id", claims.observer_site_id).eq("task_kind", "legacy_command")
      .is("gateway_id", null).eq("source.metadata->>gateway_id", claims.gateway_id);
    let found = await scopedQueue().eq("id", payload.request_id).maybeSingle();
    if (found.error) return fail("Camera queue is unavailable.", 503);
    // Pre-extension workers may still report a failure for a delivered legacy
    // row with no persisted binding. Accept only failure, using the source's
    // authenticated Gateway/site mapping; never backfill approval or capability.
    if (!found.data && payload.outcome === "failed") found = await legacyResult().maybeSingle();
    if (found.error) return fail("Camera queue is unavailable.", 503);
    const row = found.data as JoinedRow | null;
    if (!row) return fail("Camera action is unavailable for this Gateway.", 409);
    const legacyFailure = row.task_kind === "legacy_command" && payload.outcome === "failed" && row.gateway_id === null;
    const validBinding = legacyFailure
      ? row.observer_site_id === claims.observer_site_id && row.source?.id === row.camera_source_id
        && row.source.observer_site_id === row.observer_site_id && row.source.metadata?.gateway_id === claims.gateway_id
        && typeof row.source.metadata.gateway_stream_id === "string" && row.source.metadata.gateway_stream_id.length > 0
      : queueBindingMatches(row, row.source, claims);
    if (!validBinding) return fail("Camera source mapping changed or belongs to another Gateway.", 403);

    const resultDigest = queueResultDigest(payload);
    // An identical retry repairs a lost HTTP response without rewriting the
    // result or re-executing. Conflicting terminal results are rejected.
    if ((terminalStatuses as readonly string[]).includes(row.action_status)) {
      return row.result_digest === resultDigest ? ok({ recorded: true, replay: true })
        : fail("A different result was already recorded.", 409);
    }
    if (row.action_status !== "delivered") return fail("Camera action is not awaiting a result.", 409);
    const resultDeadline = Date.parse(row.expires_at) + (row.task_kind === "physical_command" ? PHYSICAL_RESULT_GRACE_MS : 0);
    if (resultDeadline <= Date.now()) return fail("Camera action result window expired.", 410);
    if (row.task_kind === "legacy_command") {
      if (payload.outcome !== "failed") return fail("Legacy physical commands have no installed executor.", 422);
    } else {
      // Physical execution may finish just after its dispatch TTL; its
      // completion timestamp is checked against the narrow ACK grace below.
      if (row.task_kind !== "physical_command") queueTask(row);
      validateQueueResult(payload, row);
    }
    const completedAt = new Date().toISOString();
    const terminal = persistedTerminal(payload);
    let update = supabase.from("digital_observer_camera_action_requests")
      .update({ ...terminal, completed_at: completedAt, updated_at: completedAt, result_digest: resultDigest,
        result: { ...payload, reported_by_gateway: true } })
      .eq("id", row.id).eq("observer_site_id", claims.observer_site_id)
      .eq("action_status", "delivered");
    if (row.task_kind !== "physical_command") update = update.gt("expires_at", completedAt);
    update = legacyFailure ? update.eq("task_kind", "legacy_command").is("gateway_id", null) : update.eq("gateway_id", claims.gateway_id);
    const updated = await update.select("id").maybeSingle();
    if (updated.error) return fail("Camera action result could not be recorded.", 503);
    if (!updated.data) {
      const replay = await (legacyFailure ? legacyResult() : scopedQueue().eq("id", row.id)).maybeSingle();
      if (replay.error) return fail("Camera action result could not be recorded.", 503);
      if (replay.data?.result_digest === resultDigest && (terminalStatuses as readonly string[]).includes(replay.data.action_status)) {
        return ok({ recorded: true, replay: true });
      }
      return fail("Camera action result lost its delivery claim.", 409);
    }
    return ok({ recorded: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CAMERA_QUEUE_")) {
      return fail(error.message === "CAMERA_QUEUE_DATABASE_UNAVAILABLE" ? "Camera queue is unavailable." : "Camera diagnostic contract or evidence is invalid.",
        error.message === "CAMERA_QUEUE_DATABASE_UNAVAILABLE" ? 503 : 422);
    }
    return handleRouteError(error);
  }
}
