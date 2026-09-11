import { AI_QUEUE_BACKEND_CONTRACT } from "./ai-queue-backend-contract.mjs";

export const POSTGRES_AI_QUEUE_BACKEND = Object.freeze({
  contract: AI_QUEUE_BACKEND_CONTRACT,
  backend_id: "postgres-shared-transactional",
  backend_class: "POSTGRES_SHARED_TRANSACTIONAL",
  multi_host_ready: true,
  evidence_levels: ["PRODUCTION_READY_CONTRACT", "LOCAL_TRANSACTIONAL_QA"],
  claim_rpc: "observer_ai_job_claim_v1",
  acknowledgement_rpc: "observer_ai_job_ack_v1",
  requirements: ["server-side transaction", "FOR UPDATE SKIP LOCKED", "server clock lease", "unique job/idempotency/result keys", "RLS or trusted service boundary"]
});

const required = (value, name) => { if (typeof value !== "string" || !value) throw new Error(`postgres_ai_queue_${name}_required`); return value; };

// This adapter is intentionally transport-only: canonical job validation and
// Product-effect idempotency remain in PUSH 31. The supplied RPC client must be
// an authenticated tenant-scoped service client backed by the canonical SQL.
export function createPostgresAiQueueBackend({ rpc, identity } = {}) {
  if (typeof rpc !== "function") throw new Error("postgres_ai_queue_rpc_required");
  if (identity?.authenticated !== true || identity.revoked === true) throw new Error("postgres_ai_queue_identity_required");
  const call = async (name, input = {}) => {
    const result = await rpc(name, input);
    if (result?.error) throw new Error(`postgres_ai_queue_${name}_failed`);
    return result?.data ?? result;
  };
  return Object.freeze({ ...POSTGRES_AI_QUEUE_BACKEND,
    enqueue: job => call("observer_ai_job_enqueue_v1", { p_job: job }),
    claim: worker => call("observer_ai_job_claim_v1", { p_worker_id: required(worker?.worker_id, "worker_id"), p_tenant_ids: worker.identity?.tenant_ids ?? [], p_site_ids: worker.identity?.site_ids ?? [], p_capabilities: worker.capabilities ?? [], p_model_classes: worker.model_classes ?? [] }),
    acknowledge: (worker, jobId, result) => call("observer_ai_job_ack_v1", { p_worker_id: required(worker?.worker_id, "worker_id"), p_job_id: required(jobId, "job_id"), p_result: result }),
    fail: (worker, jobId, classification, reason) => call("observer_ai_job_fail_v1", { p_worker_id: required(worker?.worker_id, "worker_id"), p_job_id: required(jobId, "job_id"), p_classification: classification, p_reason: reason }),
    result: jobId => call("observer_ai_job_result_v1", { p_job_id: required(jobId, "job_id") }),
    snapshot: () => call("observer_ai_queue_snapshot_v1", {}),
    recover: () => call("observer_ai_queue_recover_v1", {}),
    close: async () => undefined
  });
}
