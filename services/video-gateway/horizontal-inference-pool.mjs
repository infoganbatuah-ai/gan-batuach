import { AI_WORKER_CONTRACT } from "./ai-job-contract.mjs";

export const AI_WORKER_POOL_CONTRACT = "observer-inference-worker-pool-v1";

export function createHorizontalInferencePool({ queue, now = Date.now } = {}) {
  if (!queue || typeof queue.claim !== "function") throw new Error("ai_worker_pool_queue_required");
  const workers = new Map();
  const metrics = { additions: 0, removals: 0, completed: 0, failures: 0, loops: 0 };
  const healthy = worker => worker.identity?.authenticated === true && worker.identity?.revoked !== true
    && worker.available !== false && !["UNHEALTHY", "CRASH_LOOP"].includes(worker.health);

  function add(worker) {
    if (worker?.contract !== AI_WORKER_CONTRACT || typeof worker.processOne !== "function") throw new Error("ai_worker_pool_registration_invalid");
    if (!healthy(worker)) throw new Error("ai_worker_pool_identity_or_health_denied");
    if (workers.has(worker.worker_id)) throw new Error("ai_worker_pool_duplicate_worker");
    workers.set(worker.worker_id, { worker, enabled: true, added_at: now() }); metrics.additions++;
    return worker.worker_id;
  }

  function remove(workerId) {
    const record = workers.get(workerId); if (!record) return false;
    record.enabled = false; workers.delete(workerId); metrics.removals++; return true;
  }

  async function drain({ maxRounds = 100_000, idleRounds = 2 } = {}) {
    let idle = 0, rounds = 0;
    while (idle < idleRounds && rounds < maxRounds) {
      const active = [...workers.values()].filter(record => record.enabled && healthy(record.worker));
      if (!active.length) break;
      const results = await Promise.all(active.map(record => record.worker.processOne(queue)));
      metrics.loops++; rounds++;
      const worked = results.filter(result => result.status !== "IDLE");
      if (!worked.length) idle++; else idle = 0;
      metrics.completed += results.filter(result => result.status === "COMPLETED").length;
      metrics.failures += results.filter(result => !["IDLE", "COMPLETED"].includes(result.status)).length;
    }
    return snapshot();
  }

  function snapshot() {
    const active = [...workers.values()].filter(record => record.enabled);
    return Object.freeze({ contract: AI_WORKER_POOL_CONTRACT, active_workers: active.length,
      capabilities: [...new Set(active.flatMap(record => record.worker.capabilities))],
      capacity_classes: [...new Set(active.map(record => record.worker.capacity_class))], ...metrics,
      workers: active.map(record => record.worker.snapshot()) });
  }

  return Object.freeze({ contract: AI_WORKER_POOL_CONTRACT, add, remove, drain, snapshot });
}
