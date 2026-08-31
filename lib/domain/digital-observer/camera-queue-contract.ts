import { createHash } from "node:crypto";
import { z } from "zod";

export const CAMERA_QUEUE_TTL_MS = 120_000;
export const CAMERA_QUEUE_DRIVER = "private_nvr_http_api_v1";
export const cameraQueueKinds = ["capability_snapshot", "command_preflight"] as const;
const action = z.enum(["ptz", "talk", "siren", "lighting"]);
const stream = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });
const baseTask = {
  id: z.string().uuid(), camera_id: z.string().uuid(), site_id: z.string().uuid(),
  stream_id: stream, channel: z.number().int().min(1).max(64),
  requested_at: timestamp, expires_at: timestamp
};
export const cameraQueueTaskSchema = z.discriminatedUnion("task_kind", [
  z.object({ ...baseTask, task_kind: z.literal("capability_snapshot") }).strict(),
  z.object({ ...baseTask, task_kind: z.literal("command_preflight"), action, payload_digest: digest }).strict()
]);

const commonResult = {
  camera_id: z.string().uuid(), site_id: z.string().uuid(),
  stream_id: stream, channel: z.number().int().min(1).max(64),
  executor_installed: z.literal(false), evidence_id: z.string().uuid(), verified_at: timestamp.nullable()
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
    ...commonResult,
    driver: z.literal(CAMERA_QUEUE_DRIVER), provider: z.literal(CAMERA_QUEUE_DRIVER),
    capabilities: z.object({ ptz: z.boolean(), twoWayAudio: z.boolean(), siren: z.boolean(), lighting: z.boolean() }).strict(),
    details: z.object({ ptz: detail, twoWayAudio: detail, siren: detail, lighting: detail }).strict(),
    // The current read-only driver omits this field on snapshots. Normalize it
    // explicitly; a supplied true value is always rejected.
    executed: z.literal(false).default(false)
  }).strict()
}).strict();
const preflightResult = z.object({
  action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("command_preflight"),
  result_code: z.enum(["preflight_only", "unsupported", "unavailable"]),
  outcome_payload: z.object({ ...commonResult, action, supported: z.boolean(), ack_kind: z.literal("preflight_only"),
    executed: z.literal(false), requires_immediate_confirmation: z.literal(true) }).strict()
}).strict();
// Legacy workers can report failure. No worker may report physical success on
// this endpoint until a separate server-authorized executor model exists.
const failedResult = z.object({ action: z.literal("result"), request_id: z.string().uuid(), outcome: z.literal("failed"),
  result_code: z.string().regex(/^[A-Za-z0-9_]{2,80}$/) }).strict();
export const cameraQueueResultSchema = z.discriminatedUnion("outcome", [snapshotResult, preflightResult, failedResult]);
export const cameraQueueRequestSchema = z.union([z.object({ action: z.literal("poll") }).strict(), cameraQueueResultSchema]);
export type CameraQueueResult = z.infer<typeof cameraQueueResultSchema>;

// The database retains its existing foreign-key names. The wire aliases are
// camera_id = camera_source_id and site_id = observer_site_id, never streams.id.
export type CameraQueueRow = {
  id: string; camera_source_id: string; observer_site_id: string; gateway_id: string | null;
  stream_id: string | null; channel: number | null; requested_at: string | null; expires_at: string;
  task_kind: "legacy_command" | typeof cameraQueueKinds[number]; action_type: string;
  payload_digest: string | null; action_status: string; result_digest: string | null;
  delivered_at?: string | null;
};
export type QueueSource = { id: string; observer_site_id: string; metadata?: Record<string, unknown> | null };
export const cameraQueueSelect = "id,camera_source_id,observer_site_id,gateway_id,stream_id,channel,requested_at,expires_at,task_kind,action_type,payload_digest,action_status,result_digest,delivered_at";
export const cameraQueueSourceSelect = "source:digital_observer_camera_sources!inner(id,observer_site_id,metadata)";

export function queueBindingMatches(row: CameraQueueRow, source: QueueSource, claims: { gateway_id: string; observer_site_id: string }) {
  return row.observer_site_id === claims.observer_site_id && row.gateway_id === claims.gateway_id
    && source?.id === row.camera_source_id && source.observer_site_id === row.observer_site_id
    && source.metadata?.gateway_id === row.gateway_id && source.metadata.gateway_stream_id === row.stream_id
    && source.metadata.dvr_channel === row.channel;
}

export function queueTask(row: CameraQueueRow, now = Date.now()) {
  const requested = Date.parse(row.requested_at ?? ""), expires = Date.parse(row.expires_at);
  if (!Number.isFinite(requested) || !Number.isFinite(expires) || requested > now + 5_000
    || expires <= now || expires <= requested || expires - requested > CAMERA_QUEUE_TTL_MS || now - requested > CAMERA_QUEUE_TTL_MS) {
    throw new Error("CAMERA_QUEUE_EXPIRED");
  }
  return cameraQueueTaskSchema.parse({ id: row.id, task_kind: row.task_kind, camera_id: row.camera_source_id, site_id: row.observer_site_id,
    stream_id: row.stream_id, channel: row.channel, requested_at: row.requested_at, expires_at: row.expires_at,
    ...(row.task_kind === "command_preflight" ? { action: row.action_type, payload_digest: row.payload_digest } : {}) });
}

export function validateQueueResult(result: CameraQueueResult, row: CameraQueueRow, now = Date.now()) {
  if (result.outcome === "failed") return;
  if (row.task_kind !== result.outcome) throw new Error("CAMERA_QUEUE_RESULT_KIND");
  const value = result.outcome_payload;
  if (value.camera_id !== row.camera_source_id || value.site_id !== row.observer_site_id
    || value.stream_id !== row.stream_id || value.channel !== row.channel) throw new Error("CAMERA_QUEUE_RESULT_SCOPE");
  const verified = value.verified_at === null ? null : Date.parse(value.verified_at);
  if (verified !== null && (verified > now + 5_000 || now - verified > CAMERA_QUEUE_TTL_MS
    || verified < Date.parse(row.requested_at ?? "") - 5_000 || verified > Date.parse(row.expires_at))) throw new Error("CAMERA_QUEUE_EVIDENCE_STALE");
  if (result.outcome === "capability_snapshot") {
    const value = result.outcome_payload;
    if (value.stream_id !== row.stream_id || value.channel !== row.channel) throw new Error("CAMERA_QUEUE_RESULT_SCOPE");
    for (const key of capabilityKeys) {
      const evidence = value.details[key];
      const tested = evidence.method === "vendor_read_only_api";
      if (evidence.supported !== value.capabilities[key] || (evidence.supported && !tested)
        || (tested && (!value.verified_at || evidence.tested_at !== value.verified_at))
        || (!tested && evidence.tested_at !== null)
        || evidence.reason !== (!tested ? "capability_probe_unavailable" : evidence.supported ? "read_only_capability_verified" : "capability_not_reported")) throw new Error("CAMERA_QUEUE_EVIDENCE_INVALID");
    }
    const tested = capabilityKeys.some(key => value.details[key].method !== "not_tested");
    const expected = !tested ? "unavailable" : capabilityKeys.some(key => value.capabilities[key]) ? "verified" : "unsupported";
    if (result.result_code !== expected || tested !== (verified !== null)) throw new Error("CAMERA_QUEUE_EVIDENCE_INVALID");
  } else {
    if (result.outcome_payload.action !== row.action_type) throw new Error("CAMERA_QUEUE_RESULT_ACTION");
    const expected = verified === null ? "unavailable" : result.outcome_payload.supported ? "preflight_only" : "unsupported";
    if (result.result_code !== expected || (verified === null && result.outcome_payload.supported)) throw new Error("CAMERA_QUEUE_EVIDENCE_INVALID");
  }
}

export function queueResultDigest(result: CameraQueueResult) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
  return createHash("sha256").update(JSON.stringify(canonical(result))).digest("hex");
}
