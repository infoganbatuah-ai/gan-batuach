import { createHash } from "node:crypto";
import { z } from "zod";

export const CAMERA_QUEUE_TTL_MS = 120_000;
export const PHYSICAL_COMMAND_TTL_MS = 30_000;
export const PHYSICAL_RESULT_GRACE_MS = 60_000;
export const CAPABILITY_EVIDENCE_MAX_AGE_MS = 5 * 60_000;
export const LIVE_EVIDENCE_MAX_AGE_MS = 30_000;
export const CAMERA_QUEUE_DRIVER = "private_nvr_http_api_v1";
export const cameraQueueKinds = ["capability_snapshot", "command_preflight", "physical_command"] as const;
export const physicalCameraActions = ["lighting", "siren", "ptz"] as const;
export type GuardCameraAction = typeof physicalCameraActions[number];

const diagnosticAction = z.enum(["ptz", "talk", "siren", "lighting"]);
const physicalAction = z.enum(physicalCameraActions);
const stream = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
const generation = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });
const baseTask = {
  id: z.string().uuid(), camera_id: z.string().uuid(), site_id: z.string().uuid(),
  stream_id: stream, channel: z.number().int().min(1).max(64),
  requested_at: timestamp, expires_at: timestamp
};
const physicalPayload = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lighting"), payload: z.object({ enabled: z.boolean(), level: z.number().int().min(0).max(100).optional(), duration_ms: z.number().int().min(1_000).max(30_000).optional() }).strict() }).strict(),
  z.object({ action: z.literal("siren"), payload: z.object({ enabled: z.boolean(), duration_ms: z.number().int().min(250).max(5_000), volume: z.number().int().min(0).max(100).optional() }).strict() }).strict(),
  z.object({ action: z.literal("ptz"), payload: z.object({ command: z.enum([
    "Ptz_Cmd_Up", "Ptz_Cmd_Down", "Ptz_Cmd_Left", "Ptz_Cmd_Right",
    "Ptz_Cmd_UpLeft", "Ptz_Cmd_UpRight", "Ptz_Cmd_DownLeft", "Ptz_Cmd_DownRight",
    "Ptz_Cmd_ZoomMinus", "Ptz_Cmd_ZoomAdd", "Ptz_Cmd_FocusMinus", "Ptz_Cmd_FocusAdd"
  ]), duration_ms: z.number().int().min(50).max(500), speed: z.number().int().min(0).max(100) }).strict() }).strict()
]);
const confirmation = z.object({
  id: z.string().uuid(), request_id: z.string().uuid(), site_id: z.string().uuid(), camera_id: z.string().uuid(),
  gateway_id: stream, stream_id: stream, channel: z.number().int().min(1).max(64),
  source_generation: generation, binding_generation: generation, action: physicalAction,
  payload_digest: digest, actor_id: z.string().uuid(), confirmed_at: timestamp, expires_at: timestamp
}).strict();

export const cameraQueueTaskSchema = z.discriminatedUnion("task_kind", [
  z.object({ ...baseTask, task_kind: z.literal("capability_snapshot") }).strict(),
  z.object({ ...baseTask, task_kind: z.literal("command_preflight"), action: diagnosticAction, payload_digest: digest }).strict(),
  z.object({ ...baseTask, task_kind: z.literal("physical_command"), action: physicalAction,
    gateway_id: stream, source_generation: generation, binding_generation: generation,
    payload: z.record(z.string(), z.unknown()), payload_digest: digest, confirmation }).strict()
]);

const liveEvidence = z.object({ tested: z.boolean(), media_progressing: z.boolean(), verified_at: timestamp.nullable() }).strict();
const commonResult = {
  camera_id: z.string().uuid(), site_id: z.string().uuid(), gateway_id: stream.optional(), stream_id: stream,
  source_generation: generation.optional(), binding_generation: generation.optional(),
  channel: z.number().int().min(1).max(64), executor_installed: z.boolean(),
  evidence_id: z.string().uuid(), verified_at: timestamp.nullable()
};
const detail = z.object({
  supported: z.boolean(), method: z.enum(["vendor_read_only_api", "not_tested"]),
  tested_at: timestamp.nullable(), adapter: z.literal(CAMERA_QUEUE_DRIVER),
  reason: z.enum(["capability_probe_unavailable", "read_only_capability_verified", "capability_not_reported"])
}).strict();
const capabilityKeys = ["ptz", "twoWayAudio", "siren", "lighting"] as const;
const snapshotResult = z.object({
  action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("capability_snapshot"),
  result_code: z.enum(["verified", "unsupported", "unavailable"]),
  outcome_payload: z.object({
    ...commonResult, driver: z.literal(CAMERA_QUEUE_DRIVER), provider: z.literal(CAMERA_QUEUE_DRIVER),
    capabilities: z.object({ ptz: z.boolean(), twoWayAudio: z.boolean(), siren: z.boolean(), lighting: z.boolean() }).strict(),
    details: z.object({ ptz: detail, twoWayAudio: detail, siren: detail, lighting: detail }).strict(),
    live: liveEvidence.optional(), executed: z.literal(false).default(false)
  }).strict()
}).strict();
const preflightResult = z.object({
  action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("command_preflight"),
  result_code: z.enum(["preflight_only", "unsupported", "unavailable"]),
  outcome_payload: z.object({ ...commonResult, action: diagnosticAction, supported: z.boolean(),
    ack_kind: z.literal("preflight_only"), executed: z.literal(false), requires_immediate_confirmation: z.literal(true), live: liveEvidence.optional() }).strict()
}).strict();
const physicalResultScope = {
  request_id: z.string().uuid(), site_id: z.string().uuid(), camera_id: z.string().uuid(), gateway_id: stream, stream_id: stream,
  source_generation: generation, binding_generation: generation, channel: z.number().int().min(1).max(64), action: physicalAction,
  executor_installed: z.literal(true)
};
const physicalResult = z.object({
  action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("physical_command"),
  result_code: z.literal("acknowledged"),
  outcome_payload: z.object({
    ...physicalResultScope, executed: z.literal(true),
    ack_kind: z.enum(["read_back_state_ack", "explicit_start_stop_ack"]), audit_digest: digest, completed_at: timestamp
  }).strict()
}).strict();
const reconciliationPhase = z.object({
  write_attempted: z.literal(true), ack_observed: z.literal(true), state_verified: z.boolean()
}).strict();
const unknownPhase = z.object({
  write_attempted: z.literal(true), ack_observed: z.literal(false), state_verified: z.literal(false)
}).strict();
const reconciliationResult = z.object({
  action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("acknowledged_needs_reconciliation"),
  result_code: z.literal("acknowledged_needs_reconciliation"),
  outcome_payload: z.object({ ...physicalResultScope, executed: z.null(), non_retryable: z.literal(true),
    phase: reconciliationPhase, audit_digest: digest, error_code: z.string().regex(/^[A-Za-z0-9_]{2,80}$/), reported_at: timestamp }).strict()
}).strict();
const unknownResult = z.object({
  action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("unknown_non_retryable"),
  result_code: z.literal("unknown_non_retryable"),
  outcome_payload: z.object({ ...physicalResultScope, executed: z.null(), non_retryable: z.literal(true),
    phase: unknownPhase, audit_digest: digest, error_code: z.string().regex(/^[A-Za-z0-9_]{2,80}$/), reported_at: timestamp }).strict()
}).strict();
const failedResult = z.object({ action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("failed"),
  result_code: z.string().regex(/^[A-Za-z0-9_]{2,80}$/) }).strict();

export const cameraQueueResultSchema = z.discriminatedUnion("outcome", [
  snapshotResult, preflightResult, physicalResult, reconciliationResult, unknownResult, failedResult
]);
export const cameraQueueRequestSchema = z.union([z.object({ action: z.literal("poll") }).strict(), cameraQueueResultSchema]);
export type CameraQueueResult = z.infer<typeof cameraQueueResultSchema>;

export type CameraQueueRow = {
  id: string; camera_source_id: string; observer_site_id: string; gateway_id: string | null;
  stream_id: string | null; channel: number | null; source_generation?: string | null; binding_generation?: string | null;
  requested_at: string | null; expires_at: string;
  task_kind: "legacy_command" | typeof cameraQueueKinds[number]; action_type: string;
  payload_digest: string | null; action_status: string; result_digest: string | null;
  requested_by: string; confirmed_by?: string | null; confirmed_at?: string | null;
  confirmation_id?: string | null; confirmation_expires_at?: string | null;
  parameters?: Record<string, unknown> | null; capability_evidence?: Record<string, unknown> | null;
  request_origin?: string; dispatch_intent_digest?: string | null; delivered_at?: string | null;
  non_retryable?: boolean | null; result_phase?: Record<string, unknown> | null;
};
export type QueueSource = { id: string; observer_site_id: string; status?: string | null; health_status?: string | null; metadata?: Record<string, unknown> | null };
export const cameraQueueSelect = "id,camera_source_id,observer_site_id,gateway_id,stream_id,channel,source_generation,binding_generation,requested_at,expires_at,task_kind,action_type,payload_digest,action_status,result_digest,delivered_at,requested_by,confirmed_by,confirmed_at,confirmation_id,confirmation_expires_at,parameters,capability_evidence,request_origin,dispatch_intent_digest,non_retryable,result_phase";
export const cameraQueueSourceSelect = "source:digital_observer_camera_sources!inner(id,observer_site_id,status,health_status,metadata)";

export function canonicalDigest(value: unknown) {
  const canonical = (child: unknown): unknown => Array.isArray(child) ? child.map(canonical)
    : child && typeof child === "object" ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)])) : child;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function physicalPayloadDigest(action: typeof physicalCameraActions[number], payload: Record<string, unknown>) {
  const parsed = physicalPayload.parse({ action, payload });
  return { payload: parsed.payload, digest: canonicalDigest(parsed.payload) };
}

export function queueBindingMatches(row: CameraQueueRow, source: QueueSource, claims: { gateway_id: string; observer_site_id: string }) {
  return row.observer_site_id === claims.observer_site_id && row.gateway_id === claims.gateway_id
    && source?.id === row.camera_source_id && source.observer_site_id === row.observer_site_id
    && source.metadata?.gateway_id === row.gateway_id && source.metadata.gateway_stream_id === row.stream_id
    && source.metadata.dvr_channel === row.channel;
}

export function queueTask(row: CameraQueueRow, now = Date.now()) {
  const requested = Date.parse(row.requested_at ?? ""), expires = Date.parse(row.expires_at);
  const ttl = row.task_kind === "physical_command" ? PHYSICAL_COMMAND_TTL_MS : CAMERA_QUEUE_TTL_MS;
  if (!Number.isFinite(requested) || !Number.isFinite(expires) || requested > now + 5_000
    || expires <= now || expires <= requested || expires - requested > ttl || now - requested > ttl) throw new Error("CAMERA_QUEUE_EXPIRED");
  const base = { id: row.id, task_kind: row.task_kind, camera_id: row.camera_source_id, site_id: row.observer_site_id,
    stream_id: row.stream_id, channel: row.channel, requested_at: row.requested_at, expires_at: row.expires_at };
  if (row.task_kind === "physical_command") {
    if (!row.confirmation_id || !row.confirmed_by || !row.confirmed_at || !row.confirmation_expires_at) throw new Error("CAMERA_QUEUE_CONFIRMATION_MISSING");
    return cameraQueueTaskSchema.parse({ ...base, gateway_id: row.gateway_id, source_generation: row.source_generation,
      binding_generation: row.binding_generation, action: row.action_type, payload: row.parameters, payload_digest: row.payload_digest,
      confirmation: { id: row.confirmation_id, request_id: row.id, site_id: row.observer_site_id, camera_id: row.camera_source_id,
        gateway_id: row.gateway_id, stream_id: row.stream_id, channel: row.channel, source_generation: row.source_generation,
        binding_generation: row.binding_generation, action: row.action_type, payload_digest: row.payload_digest, actor_id: row.confirmed_by,
        confirmed_at: row.confirmed_at, expires_at: row.confirmation_expires_at } });
  }
  return cameraQueueTaskSchema.parse({ ...base,
    ...(row.task_kind === "command_preflight" ? { action: row.action_type, payload_digest: row.payload_digest } : {}) });
}

function validLiveEvidence(value: unknown, now: number) {
  const parsed = liveEvidence.safeParse(value);
  if (!parsed.success || parsed.data.tested !== true || parsed.data.media_progressing !== true || !parsed.data.verified_at) return false;
  const verified = Date.parse(parsed.data.verified_at);
  return Number.isFinite(verified) && verified <= now + 5_000 && now - verified <= LIVE_EVIDENCE_MAX_AGE_MS;
}

export function allowedPhysicalControls(result: unknown, now = Date.now()): Array<typeof physicalCameraActions[number]> {
  const parsed = snapshotResult.safeParse(result);
  if (!parsed.success || parsed.data.result_code !== "verified" || parsed.data.outcome_payload.executor_installed !== true
    || !parsed.data.outcome_payload.gateway_id || !parsed.data.outcome_payload.source_generation
    || !parsed.data.outcome_payload.binding_generation) return [];
  const verified = Date.parse(parsed.data.outcome_payload.verified_at ?? "");
  if (!Number.isFinite(verified) || verified > now + 5_000 || now - verified > CAPABILITY_EVIDENCE_MAX_AGE_MS
    || !validLiveEvidence(parsed.data.outcome_payload.live, now)) return [];
  return physicalCameraActions.filter((action) => parsed.data.outcome_payload.capabilities[action] === true);
}

export function validateQueueResult(result: CameraQueueResult, row: CameraQueueRow, now = Date.now()) {
  if (result.outcome === "failed") return;
  if (result.outcome === "physical_command") {
    if (row.task_kind !== "physical_command") throw new Error("CAMERA_QUEUE_RESULT_KIND");
    const value = result.outcome_payload;
    if (value.request_id !== row.id || value.site_id !== row.observer_site_id || value.camera_id !== row.camera_source_id
      || value.gateway_id !== row.gateway_id || value.stream_id !== row.stream_id || value.channel !== row.channel
      || value.source_generation !== row.source_generation || value.binding_generation !== row.binding_generation
      || value.action !== row.action_type || value.executor_installed !== true) throw new Error("CAMERA_QUEUE_RESULT_SCOPE");
    const terminalAt = Date.parse(value.completed_at);
    if (!Number.isFinite(terminalAt) || terminalAt > now + 5_000 || terminalAt < Date.parse(row.delivered_at ?? "") - 5_000
      || terminalAt > Date.parse(row.expires_at) + PHYSICAL_RESULT_GRACE_MS) throw new Error("CAMERA_QUEUE_RESULT_STALE");
    if (value.executed !== true) throw new Error("CAMERA_QUEUE_RESULT_SCOPE");
    return;
  }
  if (result.outcome === "acknowledged_needs_reconciliation" || result.outcome === "unknown_non_retryable") {
    if (row.task_kind !== "physical_command") throw new Error("CAMERA_QUEUE_RESULT_KIND");
    const value = result.outcome_payload;
    if (value.request_id !== row.id || value.site_id !== row.observer_site_id || value.camera_id !== row.camera_source_id
      || value.gateway_id !== row.gateway_id || value.stream_id !== row.stream_id || value.channel !== row.channel
      || value.source_generation !== row.source_generation || value.binding_generation !== row.binding_generation
      || value.action !== row.action_type || value.executor_installed !== true) throw new Error("CAMERA_QUEUE_RESULT_SCOPE");
    const terminalAt = Date.parse(value.reported_at);
    if (!Number.isFinite(terminalAt) || terminalAt > now + 5_000 || terminalAt < Date.parse(row.delivered_at ?? "") - 5_000
      || terminalAt > Date.parse(row.expires_at) + PHYSICAL_RESULT_GRACE_MS) throw new Error("CAMERA_QUEUE_RESULT_STALE");
    if (value.executed !== null || value.non_retryable !== true || value.phase.write_attempted !== true
      || (result.outcome === "acknowledged_needs_reconciliation" && value.phase.ack_observed !== true)
      || (result.outcome === "unknown_non_retryable" && (value.phase.ack_observed !== false || value.phase.state_verified !== false))) {
      throw new Error("CAMERA_QUEUE_TERMINAL_FACTS");
    }
    return;
  }
  if (row.task_kind !== result.outcome) throw new Error("CAMERA_QUEUE_RESULT_KIND");
  const common = result.outcome_payload;
  if (common.camera_id !== row.camera_source_id || common.site_id !== row.observer_site_id
    || common.stream_id !== row.stream_id || common.channel !== row.channel
    || (common.gateway_id !== undefined && common.gateway_id !== row.gateway_id)
    || (row.source_generation != null && common.source_generation !== undefined && common.source_generation !== row.source_generation)
    || (row.binding_generation != null && common.binding_generation !== undefined && common.binding_generation !== row.binding_generation)) throw new Error("CAMERA_QUEUE_RESULT_SCOPE");
  const verified = common.verified_at === null ? null : Date.parse(common.verified_at);
  if (verified !== null && (verified > now + 5_000 || now - verified > CAMERA_QUEUE_TTL_MS
    || verified < Date.parse(row.requested_at ?? "") - 5_000 || verified > Date.parse(row.expires_at))) throw new Error("CAMERA_QUEUE_EVIDENCE_STALE");
  const boundEvidence = [common.gateway_id, common.source_generation, common.binding_generation, common.live];
  if (boundEvidence.some((item) => item !== undefined)) {
    if (boundEvidence.some((item) => item === undefined) || common.gateway_id !== row.gateway_id
      || verified === null || !validLiveEvidence(common.live, now)) {
      throw new Error("CAMERA_QUEUE_BOUND_EVIDENCE_INVALID");
    }
    const liveVerified = Date.parse(common.live!.verified_at!);
    if (liveVerified > verified + 5_000) throw new Error("CAMERA_QUEUE_BOUND_EVIDENCE_INVALID");
  }
  if (result.outcome === "capability_snapshot") {
    const value = result.outcome_payload;
    for (const key of capabilityKeys) {
      const evidence = value.details[key], tested = evidence.method === "vendor_read_only_api";
      if (evidence.supported !== value.capabilities[key] || (evidence.supported && !tested)
        || (tested && (!value.verified_at || evidence.tested_at !== value.verified_at)) || (!tested && evidence.tested_at !== null)
        || evidence.reason !== (!tested ? "capability_probe_unavailable" : evidence.supported ? "read_only_capability_verified" : "capability_not_reported")) throw new Error("CAMERA_QUEUE_EVIDENCE_INVALID");
    }
    const tested = capabilityKeys.some((key) => value.details[key].method !== "not_tested");
    const expected = !tested ? "unavailable" : capabilityKeys.some((key) => value.capabilities[key]) ? "verified" : "unsupported";
    if (result.result_code !== expected || tested !== (verified !== null)) throw new Error("CAMERA_QUEUE_EVIDENCE_INVALID");
  } else {
    const value = result.outcome_payload;
    if (value.action !== row.action_type) throw new Error("CAMERA_QUEUE_RESULT_ACTION");
    const expected = verified === null ? "unavailable" : value.supported ? "preflight_only" : "unsupported";
    if (result.result_code !== expected || (verified === null && value.supported)) throw new Error("CAMERA_QUEUE_EVIDENCE_INVALID");
  }
}

export function queueResultDigest(result: CameraQueueResult) { return canonicalDigest(result); }
