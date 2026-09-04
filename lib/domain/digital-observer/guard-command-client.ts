import "server-only";

import { z } from "zod";
import { physicalPayloadDigest } from "./camera-queue-contract";
import {
  authorizeAutonomousGuardAction,
  recommendGuardCameraAction,
  type AutonomousGuardAction,
  type GuardAutomationEvent,
  type GuardAutomationPolicy
} from "./guard-engine";

const enqueueResultSchema = z.object({
  status: z.enum(["queued", "duplicate", "blocked"]),
  reason: z.string().optional(),
  request_id: z.string().uuid().optional(),
  action: z.enum(["lighting", "siren"]).optional(),
  action_status: z.string().optional()
}).strict();

const capabilityRefreshResultSchema = z.object({
  status: z.enum(["fresh", "queued", "pending", "blocked"]),
  reason: z.string().optional(),
  request_id: z.string().uuid().optional(),
  action: z.enum(["lighting", "siren"]).optional()
}).strict();

export type GuardCommandDatabase = {
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
  from(table: string): { select(columns: string): GuardCommandQuery };
};

type GuardCommandQuery = {
  eq(column: string, value: unknown): GuardCommandQuery;
  order(column: string, options: { ascending: boolean }): GuardCommandQuery;
  limit(count: number): GuardCommandQuery;
  maybeSingle(): PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message?: string; code?: string } | null;
  }>;
};

/**
 * Server-only Digital Guard command client. The client cannot mint permissions:
 * it needs a persisted policy, a verified event and a fresh Gateway capability
 * decision. PostgreSQL repeats those checks atomically before queue insertion.
 */
export async function requestDigitalGuardCameraAction(input: {
  database: GuardCommandDatabase;
  policy: GuardAutomationPolicy;
  event: GuardAutomationEvent;
  action: AutonomousGuardAction;
  payload: Record<string, unknown>;
  capabilityDecision: ReturnType<typeof recommendGuardCameraAction>;
  now?: number;
}) {
  const decision = authorizeAutonomousGuardAction({
    policy: input.policy,
    event: input.event,
    action: input.action,
    capabilityDecision: input.capabilityDecision,
    now: input.now
  });
  if (!decision.dispatch_allowed) return decision;

  if (input.action === "lighting" && input.payload.enabled !== true) throw new Error("GUARD_LIGHTING_PAYLOAD_INVALID");
  if (input.action === "siren" && (input.payload.enabled !== true || input.payload.duration_ms !== 1000)) {
    throw new Error("GUARD_SIREN_PULSE_MUST_BE_ONE_SECOND");
  }
  const normalized = physicalPayloadDigest(input.action, input.payload);
  const result = await input.database.rpc("enqueue_digital_guard_camera_command_v1", {
    signal_id: input.event.id,
    requested_action: input.action,
    requested_payload: normalized.payload,
    requested_payload_digest: normalized.digest
  });
  if (result.error) throw new Error(`DIGITAL_GUARD_QUEUE_UNAVAILABLE:${result.error.code ?? "unknown"}`);
  const queued = enqueueResultSchema.parse(result.data);
  return { ...decision, ...queued, queued: queued.status === "queued" || queued.status === "duplicate" };
}

/**
 * Requests only a read-only hardware capability probe for a validated event.
 * PostgreSQL repeats event, policy, schedule, camera binding and tenant checks;
 * this function has no path that can create a physical command.
 */
export async function refreshDigitalGuardCapabilityForEvent(input: {
  database: GuardCommandDatabase;
  signalId: string;
  action: AutonomousGuardAction;
  gatewayId: string;
  timeoutMs?: number;
}) {
  const refresh = await input.database.rpc("enqueue_digital_guard_capability_refresh_v1", {
    signal_id: input.signalId,
    requested_action: input.action,
    requested_gateway_id: input.gatewayId
  });
  if (refresh.error) throw new Error(`DIGITAL_GUARD_CAPABILITY_REFRESH_UNAVAILABLE:${refresh.error.code ?? "unknown"}`);
  const result = capabilityRefreshResultSchema.parse(refresh.data);
  if (result.status === "blocked" || result.status === "fresh" || !result.request_id) return result;

  const deadline = Date.now() + Math.min(Math.max(input.timeoutMs ?? 14_000, 1_000), 18_000);
  while (Date.now() < deadline) {
    const found = await input.database.from("digital_observer_camera_action_requests")
      .select("id,action_status").eq("id", result.request_id)
      .eq("task_kind", "capability_snapshot").eq("request_origin", "digital_guard").maybeSingle();
    if (found.error) throw new Error("DIGITAL_GUARD_CAPABILITY_REFRESH_STATUS_UNAVAILABLE");
    if (found.data?.action_status === "completed") return { ...result, status: "fresh" as const };
    if (["failed", "expired", "blocked", "cancelled"].includes(String(found.data?.action_status ?? ""))) {
      return { ...result, status: "blocked" as const, reason: `capability_refresh_${found.data?.action_status}` };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ...result, status: "pending" as const, reason: "capability_refresh_timeout" };
}

export async function verifyDigitalGuardCommandResult(database: GuardCommandDatabase, requestId: string) {
  const found = await database.from("digital_observer_camera_action_requests")
    .select("id,request_origin,authorization_kind,action_status,completed_at,result,non_retryable")
    .eq("id", requestId).eq("request_origin", "digital_guard").eq("authorization_kind", "digital_guard_policy").maybeSingle();
  if (found.error) throw new Error("DIGITAL_GUARD_STATUS_UNAVAILABLE");
  if (!found.data) return { status: "not_found" as const, executed: false as const, gateway_confirmed: false as const };
  const result = found.data.result && typeof found.data.result === "object" && !Array.isArray(found.data.result)
    ? found.data.result as Record<string, unknown> : null;
  const outcomePayload = result?.outcome_payload && typeof result.outcome_payload === "object" && !Array.isArray(result.outcome_payload)
    ? result.outcome_payload as Record<string, unknown> : null;
  const completed = found.data.action_status === "completed"
    && result?.outcome === "physical_command"
    && outcomePayload?.executed === true
    && outcomePayload?.executor_installed === true;
  return {
    status: String(found.data.action_status),
    executed: completed,
    gateway_confirmed: completed,
    completed_at: found.data.completed_at ?? null,
    non_retryable: found.data.non_retryable === true
  };
}
