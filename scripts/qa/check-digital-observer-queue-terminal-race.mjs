import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createAiJob } from "../../services/video-gateway/ai-job-contract.mjs";
import { createDurableAiJobQueue } from "../../services/video-gateway/durable-ai-job-queue.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";

const root = mkdtempSync(join(tmpdir(), "observer-terminal-race-"));
let sequence = 0;
const identity = id => ({ authenticated: true, revoked: false, device_id: id, tenant_ids: ["tenant-qa"], site_ids: ["site-qa"] });
const actor = id => ({ worker_id: id, environment: "ISOLATED_PROCESS", identity: identity(id), capabilities: ["OBJECT_DETECTION"], model_classes: ["GENERAL_OBJECT_DETECTION"] });
const makeJob = (at = Date.now()) => {
  const id = ++sequence;
  return createAiJob({ job_id: `terminal-job-${id}`, tenant_id: "tenant-qa", site_id: "site-qa", source_id: `camera-${id % 20}`,
    observation_timestamp: new Date(at).toISOString(), priority: "NORMAL", purpose: "REALTIME_DETECTION", requested_capability: "OBJECT_DETECTION",
    model_class: "GENERAL_OBJECT_DETECTION", input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: `terminal:${id}` },
    expires_at: new Date(at + 300_000).toISOString(), idempotency_key: `terminal-key-${id}`, scheduler_reason: "TERMINAL_RACE_QA",
    scheduler_version: "observer-adaptive-sampling-v1", ordering_key: `terminal-order-${id}` }, { now: at });
};
const open = (path, now = Date.now) => createDurableAiJobQueue({ databasePath: path, now, policy: { leaseMs: 100, maxJobs: 2_000 }, workerAuthorizer: worker => worker.identity?.device_id?.startsWith("qa-") === true });
const result = jobId => ({ contract: "observer-inference-result-v1", job_id: jobId, result_id: `result-${jobId}` });

try {
  // Two independent SQLite connections exercise lease recovery and stale-worker fencing.
  let clock = Date.parse("2026-09-20T00:00:00Z");
  const path = join(root, "lease-recovery.sqlite"), first = open(path, () => clock), second = open(path, () => clock);
  const job = makeJob(clock), old = actor("qa-old"), replacement = actor("qa-replacement");
  first.enqueue(job);
  assert.equal(first.claim(old).job.job_id, job.job_id);
  clock += 101;
  assert.equal(second.claim(replacement).job.job_id, job.job_id);
  assert.throws(() => first.acknowledge(old, job.job_id, result(job.job_id)), /ai_queue_lease_invalid/);
  assert.throws(() => first.fail(old, job.job_id), /ai_queue_lease_invalid/);
  assert.throws(() => first.releaseForFailover(old, job.job_id), /ai_queue_lease_invalid/);
  assert.deepEqual(second.acknowledge(replacement, job.job_id, result(job.job_id)), { acknowledged: true, duplicate: false });
  assert.deepEqual(first.acknowledge(old, job.job_id, result(job.job_id)), { acknowledged: true, duplicate: true });
  assert.throws(() => second.fail(replacement, job.job_id), /ai_queue_lease_invalid/);
  assert.equal(second.snapshot().states.COMPLETED, 1);
  first.close(); second.close();
  const persisted = new DatabaseSync(path, { readOnly: true });
  assert.equal(persisted.prepare("SELECT count(*) n FROM ai_results WHERE job_id=?").get(job.job_id).n, 1);
  assert.equal(persisted.prepare("SELECT count(*) n FROM ai_queue_audit WHERE category='JOB_ACKNOWLEDGED' AND job_id=?").get(job.job_id).n, 1);
  persisted.close();

  const restartPath = join(root, "restart.sqlite"), beforeRestart = open(restartPath, () => clock);
  const restartJob = makeJob(clock), departed = actor("qa-departed"), resumed = actor("qa-resumed");
  beforeRestart.enqueue(restartJob);
  assert.equal(beforeRestart.claim(departed).job.job_id, restartJob.job_id);
  beforeRestart.close();
  clock += 101;
  const afterRestart = open(restartPath, () => clock);
  assert.equal(afterRestart.claim(resumed).job.job_id, restartJob.job_id);
  assert.deepEqual(afterRestart.acknowledge(resumed, restartJob.job_id, result(restartJob.job_id)), { acknowledged: true, duplicate: false });
  assert.deepEqual(afterRestart.acknowledge(departed, restartJob.job_id, result(restartJob.job_id)), { acknowledged: true, duplicate: true });
  assert.equal(afterRestart.snapshot().states.COMPLETED, 1);
  afterRestart.close();

  const expiredPath = join(root, "timeout.sqlite"), expiry = open(expiredPath, () => clock);
  const expiring = makeJob(clock), timeoutWorker = actor("qa-timeout");
  expiry.enqueue({ ...expiring, expires_at: new Date(clock + 50).toISOString() });
  assert.equal(expiry.claim(timeoutWorker).job.job_id, expiring.job_id);
  clock += 51;
  assert.deepEqual(expiry.acknowledge(timeoutWorker, expiring.job_id, result(expiring.job_id)), { acknowledged: false, state: "EXPIRED" });
  assert.throws(() => expiry.fail(timeoutWorker, expiring.job_id), /ai_queue_lease_invalid/);
  assert.equal(expiry.result(expiring.job_id), null);
  expiry.close();

  const scale = [];
  for (const count of [120, 500, 1_000]) {
    const scalePath = join(root, `scale-${count}.sqlite`), seed = open(scalePath);
    seed.enqueueMany(Array.from({ length: count }, () => makeJob())); seed.close();
    const queues = Array.from({ length: 8 }, () => open(scalePath));
    const completed = [];
    await Promise.all(queues.map(async (queue, index) => {
      const worker = createPortableInferenceWorker({ workerId: `qa-scale-${count}-${index}`, environment: "ISOLATED_PROCESS", identity: identity(`qa-scale-${count}-${index}`),
        capabilities: ["OBJECT_DETECTION"], infer: async () => { await new Promise(resolve => setTimeout(resolve, index === 0 ? 110 : 1));
          return { detections: [], model_provenance: { model: "terminal-race-qa", expected_sha256: "qa-v1", runtime: "node" } }; } });
      let idle = 0;
      while (idle < 150) {
        const response = await worker.processOne(queue);
        if (response.status === "IDLE") { idle++; await new Promise(resolve => setTimeout(resolve, 2)); }
        else { idle = 0; if (response.status === "COMPLETED") completed.push(response.job_id); }
      }
      queue.close();
    }));
    const verify = open(scalePath), state = verify.snapshot(); verify.close();
    const db = new DatabaseSync(scalePath, { readOnly: true });
    const results = db.prepare("SELECT count(*) n, count(DISTINCT job_id) unique_jobs FROM ai_results").get();
    const audits = db.prepare("SELECT count(*) n FROM ai_queue_audit WHERE category='JOB_ACKNOWLEDGED'").get(); db.close();
    assert.equal(state.states.COMPLETED, count);
    assert.equal(completed.length, count);
    assert.equal(new Set(completed).size, count);
    assert.equal(results.n, count); assert.equal(results.unique_jobs, count); assert.equal(audits.n, count);
    scale.push({ submitted: count, completed: completed.length, unique_results: results.unique_jobs, terminal_audits: audits.n, lease_claims: state.lease_claim_count });
  }
  console.log(JSON.stringify({ status: "PASS", stale_lease: "REJECTED", duplicate_ack: "NO_NEW_COMPLETION", restart: "ONE_TERMINAL_RESULT", timeout: "ONE_TERMINAL_STATE", scale }));
} finally { rmSync(root, { recursive: true, force: true }); }
