import { createHash, randomUUID } from "node:crypto";

export const AI_JOB_CONTRACT = "observer-ai-job-v1";
export const AI_RESULT_CONTRACT = "observer-inference-result-v1";
export const AI_WORKER_CONTRACT = "observer-inference-worker-v1";
export const AI_JOB_PRIORITIES = Object.freeze(["CRITICAL", "HIGH", "NORMAL", "LOW", "LEARNING"]);
export const AI_JOB_CAPABILITIES = Object.freeze(["OBJECT_DETECTION"]);
export const AI_JOB_PURPOSES = Object.freeze(["REALTIME_DETECTION", "TRACKING_CONTINUITY", "SITE_LEARNING", "INVESTIGATION"]);
export const AI_PRIORITY_WEIGHT = Object.freeze({ CRITICAL: 500, HIGH: 400, NORMAL: 300, LOW: 200, LEARNING: 100 });

const FORBIDDEN = /(password|secret|authorization|private.?key|credential|stream.?url|signed.?url|token)/i;
const text = (value, name, max = 240) => {
  if (typeof value !== "string" || !value || value.length > max) throw new Error(`ai_job_${name}_invalid`);
  return value;
};
const timestamp = (value, name) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`ai_job_${name}_invalid`);
  return new Date(parsed).toISOString();
};
function secretSafe(value, depth = 0) {
  if (depth > 8) throw new Error("ai_job_payload_depth");
  if (Array.isArray(value)) return value.map(item => secretSafe(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) throw new Error("ai_job_secret_field_rejected");
    output[key] = secretSafe(item, depth + 1);
  }
  return output;
}
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createAiJob(input, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const observedAt = timestamp(input.observation_timestamp ?? input.observed_at, "observed_at");
  const expiresAt = timestamp(input.expires_at, "expires_at");
  if (Date.parse(expiresAt) <= Date.parse(observedAt)) throw new Error("ai_job_expiry_invalid");
  const priority = AI_JOB_PRIORITIES.includes(input.priority) ? input.priority : "NORMAL";
  const purpose = AI_JOB_PURPOSES.includes(input.purpose) ? input.purpose : "REALTIME_DETECTION";
  const capability = AI_JOB_CAPABILITIES.includes(input.requested_capability) ? input.requested_capability : null;
  if (!capability) throw new Error("ai_job_capability_invalid");
  if (!input.input_ref || input.input_ref.kind !== "GATEWAY_SOURCE_SAMPLE" || typeof input.input_ref.reference !== "string") throw new Error("ai_job_input_ref_invalid");
  const identity = {
    tenant_id: text(input.tenant_id, "tenant"), site_id: text(input.site_id, "site"), source_id: text(input.source_id, "source"),
    observation_timestamp: observedAt, requested_capability: capability, model_class: text(input.model_class ?? "GENERAL_OBJECT_DETECTION", "model_class")
  };
  if (input.candidate && (input.candidate.contract !== "observer-ai-candidate-v2" || input.candidate.canonical_event !== false
    || input.candidate.site_id !== identity.site_id || input.candidate.source_id !== identity.source_id
    || Date.parse(input.candidate.expires_at) <= now)) throw new Error("ai_job_candidate_invalid");
  const idempotencyKey = text(input.idempotency_key ?? digest([identity, input.candidate?.candidate_id ?? null, input.scheduler_reason]), "idempotency_key");
  const retry = input.retry_policy ?? {};
  const job = {
    contract: AI_JOB_CONTRACT, schema_version: 1, job_id: text(input.job_id ?? `aij_${randomUUID()}`, "id"), ...identity,
    candidate: input.candidate ? secretSafe(input.candidate) : null, priority, purpose,
    input_ref: secretSafe(input.input_ref), expires_at: expiresAt, deadline_at: timestamp(input.deadline_at ?? expiresAt, "deadline_at"),
    retry_policy: { max_attempts: Math.max(1, Math.min(10, Math.floor(Number(retry.max_attempts ?? 3)))), base_backoff_ms: Math.max(50, Math.min(60_000, Math.floor(Number(retry.base_backoff_ms ?? 500)))) },
    idempotency_key: idempotencyKey, privacy_constraints: secretSafe(input.privacy_constraints ?? { raw_media_telemetry: false, tenant_scoped_input: true }),
    scheduler_reason: text(input.scheduler_reason ?? "FIXED_COMPATIBILITY", "scheduler_reason"),
    scheduler_version: text(input.scheduler_version ?? "legacy-fixed-sampling", "scheduler_version"),
    ordering_key: text(input.ordering_key ?? `${identity.site_id}:${identity.source_id}`, "ordering_key"), created_at: new Date(now).toISOString(), canonical_event: false
  };
  return Object.freeze(job);
}

export function validateAiJob(value) {
  if (value?.contract !== AI_JOB_CONTRACT || value?.schema_version !== 1 || value?.canonical_event !== false) throw new Error("ai_job_contract_invalid");
  return createAiJob(value, { now: Date.parse(value.created_at) });
}

export function createInferenceResult(job, input, options = {}) {
  validateAiJob(job);
  const started = timestamp(input.started_at, "result_started_at");
  const completed = timestamp(input.completed_at, "result_completed_at");
  const observed = timestamp(input.observation_timestamp ?? job.observation_timestamp, "result_observation_timestamp");
  if (Date.parse(completed) < Date.parse(started)) throw new Error("ai_result_time_invalid");
  if (!Array.isArray(input.detections)) throw new Error("ai_result_detections_invalid");
  const route = { execution_target_id: text(input.execution_target_id ?? input.worker_id, "execution_target_id"), execution_target_class: text(input.execution_target_class ?? input.worker_environment, "execution_target_class"),
    route_decision_id: input.route_decision_id ? text(input.route_decision_id, "route_decision_id") : null, routing_policy_version: input.routing_policy_version ? text(input.routing_policy_version, "routing_policy_version") : null,
    failover_history: secretSafe(input.failover_history ?? []) };
  return Object.freeze({ contract: AI_RESULT_CONTRACT, schema_version: 1, result_id: `air_${digest([job.job_id, input.worker_id, completed]).slice(0, 32)}`,
    job_id: job.job_id, idempotency_key: job.idempotency_key, tenant_id: job.tenant_id, site_id: job.site_id, source_id: job.source_id,
    observation_timestamp: observed, candidate_observation_timestamp: job.observation_timestamp, worker_id: text(input.worker_id, "worker_id"), worker_environment: text(input.worker_environment, "worker_environment"),
    model: text(input.model, "result_model"), model_version: text(input.model_version, "result_model_version"), runtime: text(input.runtime, "result_runtime"),
    detections: secretSafe(input.detections.slice(0, 100)), source_anchor: input.source_anchor ? secretSafe(input.source_anchor) : null,
    ...route, started_at: started, completed_at: completed, queue_wait_ms: Math.max(0, Math.floor(Number(options.queueWaitMs ?? 0))),
    inference_ms: Math.max(0, Math.floor(Date.parse(completed) - Date.parse(started))), detector_confidence_only: true, canonical_event: false });
}

export function assertWorkerIdentity(identity, job) {
  if (identity?.authenticated !== true || identity?.revoked === true || typeof identity.device_id !== "string") throw new Error("ai_worker_authentication_required");
  if (!identity.tenant_ids?.includes(job.tenant_id) || !identity.site_ids?.includes(job.site_id)) throw new Error("ai_worker_scope_denied");
  return true;
}
