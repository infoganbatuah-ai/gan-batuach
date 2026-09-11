export const AI_QUEUE_BACKEND_CONTRACT = "observer-ai-queue-backend-v1";

const REQUIRED = ["enqueue", "claim", "acknowledge", "fail", "result", "snapshot", "recover", "close"];

export function assertAiQueueBackend(backend) {
  if (backend?.contract !== AI_QUEUE_BACKEND_CONTRACT) throw new Error("ai_queue_backend_contract_invalid");
  for (const operation of REQUIRED) if (typeof backend[operation] !== "function") throw new Error(`ai_queue_backend_${operation}_missing`);
  if (!Array.isArray(backend.evidence_levels) || !backend.evidence_levels.length) throw new Error("ai_queue_backend_evidence_missing");
  return backend;
}

export function adaptAiQueueBackend(queue, metadata = {}) {
  const backend = {
    contract: AI_QUEUE_BACKEND_CONTRACT,
    backend_id: String(metadata.backend_id ?? "sqlite-wal-local"),
    backend_class: String(metadata.backend_class ?? "SQLITE_WAL_LOCAL_MULTI_PROCESS"),
    evidence_levels: Object.freeze([...(metadata.evidence_levels ?? ["LOCAL_MULTI_PROCESS_PROOF"])]),
    multi_host_ready: metadata.multi_host_ready === true,
    limitations: Object.freeze([...(metadata.limitations ?? ["single-host filesystem; not a multi-host production queue"])]),
  };
  for (const operation of REQUIRED) backend[operation] = queue[operation].bind(queue);
  return Object.freeze(assertAiQueueBackend(backend));
}

// Portable server-queue claim semantics. A Postgres implementation must execute
// this inside a transaction and preserve observer-ai-job-v1 unchanged.
export const POSTGRES_CLAIM_SEMANTICS = Object.freeze({
  locking: "FOR UPDATE SKIP LOCKED",
  lease: "server timestamp + bounded visibility timeout",
  acknowledgement: "atomic job completion + unique job result",
  idempotency: "unique(idempotency_key), unique(job_id)",
  fairness: "priority aging plus tenant/Site/source service cursor",
  evidence: "CONTRACT_ONLY_NOT_PRODUCTION_VERIFIED",
});
