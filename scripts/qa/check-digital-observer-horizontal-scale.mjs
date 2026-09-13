import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createAiJob } from "../../services/video-gateway/ai-job-contract.mjs";
import { createDurableAiJobQueue } from "../../services/video-gateway/durable-ai-job-queue.mjs";
import { adaptAiQueueBackend, assertAiQueueBackend, POSTGRES_CLAIM_SEMANTICS } from "../../services/video-gateway/ai-queue-backend-contract.mjs";
import { createHorizontalInferencePool } from "../../services/video-gateway/horizontal-inference-pool.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";

const root = mkdtempSync(join(tmpdir(), "observer-horizontal-scale-"));
const auth = worker => worker.identity?.device_id?.startsWith("qa-worker-") === true;
const identity = id => ({ authenticated: true, revoked: false, device_id: id,
  tenant_ids: ["tenant-a", "tenant-b", "tenant-hot", ...Array.from({ length: 10 }, (_, index) => `tenant-${index}`)],
  site_ids: ["site-a", "site-b", "site-hot", ...Array.from({ length: 50 }, (_, index) => `site-${index}`)] });
let sequence = 0;
function job(overrides = {}) {
  const at = Date.now(); const n = ++sequence;
  return createAiJob({ job_id: `scale-job-${n}`, tenant_id: "tenant-a", site_id: "site-a", source_id: `camera-${n % 11}`,
    observation_timestamp: new Date(at).toISOString(), priority: "NORMAL", purpose: "REALTIME_DETECTION", requested_capability: "OBJECT_DETECTION",
    model_class: "GENERAL_OBJECT_DETECTION", input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: `scale:${n}` },
    expires_at: new Date(at + 300_000).toISOString(), idempotency_key: `scale-key-${n}`, scheduler_reason: "PUSH36_SCALE_QA",
    scheduler_version: "observer-adaptive-sampling-v1", ordering_key: `source-order-${n}`, ...overrides }, { now: at });
}
const worker = (id, delay = 8) => createPortableInferenceWorker({ workerId: id, environment: "ISOLATED_PROCESS", identity: identity(id), capabilities: ["OBJECT_DETECTION"],
  capacityClass: "BOUNDED_CONCURRENT", infer: async () => { await new Promise(resolve => setTimeout(resolve, delay)); return { detections: [], model_provenance: { model: "scale-fixture", expected_sha256: "scale-v1", runtime: "node" } }; } });

const child = (path, id) => new Promise((resolve, reject) => { const childProcess = spawn(process.execPath, [join(process.cwd(), "scripts/qa/fixtures/horizontal-ai-worker-child.mjs"), path, id], { stdio: ["ignore", "pipe", "pipe"] }); const out = [], error = [];
  childProcess.stdout.on("data", value => out.push(value)); childProcess.stderr.on("data", value => error.push(value)); childProcess.on("exit", code => code === 0 ? resolve(JSON.parse(Buffer.concat(out).toString())) : reject(new Error(Buffer.concat(error).toString() || `child_${code}`))); });

async function processBenchmark(name, workerCount, count = 120) {
  const path = join(root, `${name}.sqlite`); let queue = createDurableAiJobQueue({ databasePath: path, workerAuthorizer: auth, policy: { maxJobs: 2_000, leaseMs: 300 } });
  queue.enqueueMany(Array.from({ length: count }, (_, index) => job({ tenant_id: `tenant-${index % 2}`, site_id: `site-${index % 5}`, source_id: `camera-${index % 20}`, ordering_key: `${name}-${index}` }))); queue.close();
  const started = performance.now(), children = await Promise.all(Array.from({ length: workerCount }, (_, index) => child(path, `qa-worker-${name}-${index}`))), elapsed = performance.now() - started;
  queue = createDurableAiJobQueue({ databasePath: path, workerAuthorizer: auth }); const snapshot = queue.snapshot(); assert.equal(snapshot.states.COMPLETED, count); assert.equal(children.reduce((sum, item) => sum + item.completed, 0), count); queue.close();
  const productiveMakespan = Math.max(...children.map(item => item.worker_cpu_ms));
  return { workers: workerCount, jobs: count, observed_wall_ms: Math.round(elapsed), productive_worker_cpu_makespan_ms: productiveMakespan,
    throughput_jobs_s: Number((count / (productiveMakespan / 1000)).toFixed(2)), aggregate_worker_cpu_ms: Number(children.reduce((sum, item) => sum + item.worker_cpu_ms, 0).toFixed(3)), queue_age_ms: snapshot.queue_age_ms };
}

try {
  const one = await processBenchmark("one", 1); const four = await processBenchmark("four", 4);
  // The portable QA host may be CPU-constrained; require a material gain, not
  // an invented linear-scaling target. Exact efficiency remains reported.
  assert.ok(four.throughput_jobs_s > one.throughput_jobs_s * 1.5, `workers did not materially scale: ${JSON.stringify({ one, four })}`);

  const multiPath = join(root, "multi-process.sqlite"); let queue = createDurableAiJobQueue({ databasePath: multiPath, workerAuthorizer: auth, policy: { leaseMs: 300 } });
  queue.enqueueMany(Array.from({ length: 120 }, (_, index) => job({ tenant_id: index % 5 === 0 ? "tenant-hot" : index % 2 ? "tenant-a" : "tenant-b", site_id: index % 5 === 0 ? "site-hot" : index % 2 ? "site-a" : "site-b", source_id: index % 7 === 0 ? "hot-camera" : `camera-${index % 18}`, ordering_key: `mp-${index}`, priority: index % 31 === 0 ? "CRITICAL" : index % 17 === 0 ? "LEARNING" : "NORMAL" })));
  const backend = adaptAiQueueBackend(queue); assertAiQueueBackend(backend); assert.equal(backend.multi_host_ready, false); assert.equal(POSTGRES_CLAIM_SEMANTICS.locking, "FOR UPDATE SKIP LOCKED"); queue.close();
  const children = await Promise.all([0, 1, 2, 3].map(index => child(multiPath, `qa-worker-child-${index}`)));
  queue = createDurableAiJobQueue({ databasePath: multiPath, workerAuthorizer: auth }); const multi = queue.snapshot();
  const completedJobIds = new Set(children.flatMap(item => item.completed_job_ids ?? []));
  assert.equal(multi.states.COMPLETED, 120); assert.equal(completedJobIds.size, 120, "every queued job must complete exactly once"); assert.equal(multi.lease_claim_count >= 120, true, "every job must be claimed before acknowledgement");
  assert.equal(multi.dead_letter_count, 0); assert.equal(multi.queue_depth, 0); queue.close();

  const fairPath = join(root, "hot-fairness.sqlite"); queue = createDurableAiJobQueue({ databasePath: fairPath, workerAuthorizer: auth });
  const hotTenant = Array.from({ length: 20 }, (_, index) => job({ tenant_id: "tenant-hot", site_id: "site-hot", source_id: `hot-${index}`, ordering_key: `hot-tenant-${index}` }));
  const quietTenant = job({ tenant_id: "tenant-b", site_id: "site-b", source_id: "quiet-tenant-camera", ordering_key: "quiet-tenant" });
  const hotCamera = job({ tenant_id: "tenant-a", site_id: "site-a", source_id: "hot-camera", ordering_key: "hot-camera-1" });
  const quietCamera = job({ tenant_id: "tenant-a", site_id: "site-a", source_id: "quiet-camera", ordering_key: "quiet-camera" });
  queue.enqueueMany([...hotTenant, quietTenant, hotCamera, quietCamera]); const fairWorker = worker("qa-worker-fairness", 0), firstClaims = [];
  for (let index = 0; index < 6; index++) firstClaims.push((await fairWorker.processOne(queue)).job_id);
  assert.ok(firstClaims.includes(quietTenant.job_id), "hot tenant starved another tenant"); assert.ok(firstClaims.includes(quietCamera.job_id), "hot camera starved another camera"); queue.close();

  const dynamicPath = join(root, "dynamic-pool.sqlite"); queue = createDurableAiJobQueue({ databasePath: dynamicPath, workerAuthorizer: auth }); queue.enqueueMany(Array.from({ length: 12 }, (_, index) => job({ ordering_key: `dynamic-${index}` })));
  const dynamicPool = createHorizontalInferencePool({ queue }); dynamicPool.add(worker("qa-worker-dynamic-a", 1)); dynamicPool.add(worker("qa-worker-dynamic-b", 1)); assert.equal(dynamicPool.remove("qa-worker-dynamic-b"), true); dynamicPool.add(worker("qa-worker-dynamic-c", 1));
  assert.throws(() => dynamicPool.add({ ...worker("qa-worker-unhealthy", 1), health: "UNHEALTHY" }), /identity_or_health_denied/);
  const dynamic = await dynamicPool.drain(); assert.equal(dynamic.active_workers, 2); assert.equal(dynamic.completed, 12); assert.equal(queue.snapshot().queue_depth, 0); queue.close();

  const lossPath = join(root, "worker-loss.sqlite"); queue = createDurableAiJobQueue({ databasePath: lossPath, workerAuthorizer: auth, policy: { leaseMs: 100 } }); const lostJob = job({ ordering_key: "loss" }); queue.enqueue(lostJob);
  const lostWorker = { worker_id: "qa-worker-lost", environment: "ISOLATED_PROCESS", capabilities: ["OBJECT_DETECTION"], model_classes: ["GENERAL_OBJECT_DETECTION"], identity: identity("qa-worker-lost") };
  assert.equal(queue.claim(lostWorker, { leaseMs: 100 }).job.job_id, lostJob.job_id); await new Promise(resolve => setTimeout(resolve, 120));
  const recovered = await worker("qa-worker-recovery", 1).processOne(queue); assert.equal(recovered.status, "COMPLETED"); assert.equal(queue.result(lostJob.job_id, { consume: true }).job_id, lostJob.job_id); assert.equal(queue.result(lostJob.job_id, { consume: true }), null); queue.close();

  const profiles = [];
  for (const cameras of [10, 100, 1_000]) { const jobs = cameras * 2, tenants = Math.min(10, Math.max(2, Math.ceil(cameras / 100))), sites = Math.min(50, Math.max(2, Math.ceil(cameras / 20)));
    const profilePath = join(root, `profile-${cameras}.sqlite`); const profileQueue = createDurableAiJobQueue({ databasePath: profilePath, workerAuthorizer: auth, policy: { maxJobs: 5_000 } });
    profileQueue.enqueueMany(Array.from({ length: jobs }, (_, index) => job({ tenant_id: `tenant-${index % tenants}`, site_id: `site-${index % sites}`, source_id: `camera-${index % cameras}`, ordering_key: `profile-${cameras}-${index}` })));
    assert.equal(profileQueue.snapshot().queue_depth, jobs); const sample = Math.min(20, jobs), profilePool = createHorizontalInferencePool({ queue: profileQueue });
    for (let index = 0; index < Math.min(8, Math.max(2, Math.ceil(cameras / 100))); index++) profilePool.add(worker(`qa-worker-profile-${cameras}-${index}`, 1));
    while ((profileQueue.snapshot().states.COMPLETED ?? 0) < sample) await Promise.all(profilePool.snapshot().workers.map((_, index) => worker(`qa-worker-profile-run-${cameras}-${index}`, 1).processOne(profileQueue)));
    const profileSnapshot = profileQueue.snapshot(); profileQueue.close();
    profiles.push({ cameras, jobs_generated: jobs, tenants, sites, empty_slots_jobs: 0, processing_sample_completed: profileSnapshot.states.COMPLETED, backlog_exercised: profileSnapshot.queue_depth, queue_age_ms: profileSnapshot.queue_age_ms,
      assumption: "2 independent synthetic jobs per active camera; no media and no Production stream load" }); }
  const efficiency = Number(((four.throughput_jobs_s / one.throughput_jobs_s) / four.workers * 100).toFixed(1));
  console.log(JSON.stringify({ status: "PASS", contract: "observer-inference-worker-pool-v1", queue_backend: "SQLITE_WAL_LOCAL_MULTI_PROCESS", evidence_level: ["LOCAL_MULTI_WORKER_PROOF", "LOCAL_MULTI_PROCESS_PROOF", "SYNTHETIC_SCALE_TEST"], multi_host_production_proof: false,
    baseline: one, scale: four, scaling_efficiency_percent: efficiency, multi_process: { workers: 4, jobs: 120, completed: 120, duplicates: 0, failures: 0, all_workers_contributed: children.every(item => item.completed > 0) }, worker_add_remove: "PASS", worker_loss_recovery: "PASS", tenant_fairness: "PASS", camera_fairness: "PASS", profiles }));
} finally { rmSync(root, { recursive: true, force: true }); }
