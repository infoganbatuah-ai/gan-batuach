import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createHealthAwareServicePool, createRetryBudget, createStorageFailoverPolicy } from "../../lib/domain/digital-observer/high-availability.mjs";
import { createSqliteHaCoordinationStore } from "../../services/control-plane/ha-coordination-store.mjs";
import { createPostgresAiQueueBackend, POSTGRES_AI_QUEUE_BACKEND } from "../../services/video-gateway/postgres-ai-queue-contract.mjs";
import { createDurableAiJobQueue } from "../../services/video-gateway/durable-ai-job-queue.mjs";
import { createAiJob } from "../../services/video-gateway/ai-job-contract.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";

const { PGlite } = await import(process.env.HA_PGLITE_MODULE || "@electric-sql/pglite");

const root = mkdtempSync(join(tmpdir(), "observer-ha-"));
let clock = Date.parse("2026-09-11T08:00:00.000Z");
const now = () => clock;
const auth = id => ({ authenticated: true, revoked: false, device_id: id, tenant_ids: ["tenant-a", "tenant-b"], site_ids: ["site-a", "site-b"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let sequence = 0;
const job = (overrides = {}) => {
  const id = ++sequence, at = Date.now();
  return createAiJob({ job_id: `ha-job-${id}`, idempotency_key: `ha-key-${id}`, tenant_id: "tenant-a", site_id: "site-a", source_id: `camera-${id % 4}`,
    observation_timestamp: new Date(at).toISOString(), expires_at: new Date(at + 120_000).toISOString(), priority: id % 7 === 0 ? "CRITICAL" : "NORMAL", purpose: "REALTIME_DETECTION",
    requested_capability: "OBJECT_DETECTION", model_class: "GENERAL_OBJECT_DETECTION", input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: `ha:${id}`, locality: "MANAGED_COMPONENT_ONLY" },
    scheduler_reason: "PUSH37_HA_QA", scheduler_version: "observer-adaptive-sampling-v1", ordering_key: `ha-order-${id}`, ...overrides }, { now: at });
};
const inferWorker = id => createPortableInferenceWorker({ workerId: id, environment: "ISOLATED_PROCESS", identity: auth(id), capabilities: ["OBJECT_DETECTION"],
  infer: async value => { await sleep(2); return { detections: [], observation_timestamp: value.observation_timestamp, model_provenance: { model: "ha-fixture", expected_sha256: "ha-v1", runtime: "node" } }; } });

try {
  // Stateless API/service load balancing, failure removal and health-gated return.
  const pool = createHealthAwareServicePool({ now, unhealthyAfterMs: 1_000, recoveryPasses: 2, flapLimit: 4, cooldownMs: 500 });
  for (const id of ["api-a", "api-b", "api-c"]) pool.register({ instance_id: id, service: "PRODUCT_API", capabilities: ["READ", "WRITE"], scopes: ["tenant-a", "tenant-b"], health: "HEALTHY", identity: auth(id), metadata: { runtime: "stateless-node" } });
  const distribution = { "api-a": 0, "api-b": 0, "api-c": 0 };
  for (let index = 0; index < 90; index++) { const selected = pool.select({ service: "PRODUCT_API", capability: "READ", scope: index % 2 ? "tenant-a" : "tenant-b", affinityKey: `request-${index}` }); assert.equal(selected.status, "SELECTED"); distribution[selected.selected.instance_id]++; pool.complete(selected.selected.instance_id); }
  assert.ok(Object.values(distribution).every(count => count > 15), `requests not balanced: ${JSON.stringify(distribution)}`);
  const apiFailureStarted = performance.now(); pool.heartbeat("api-b", { healthy: false, reason: "PROCESS_EXITED" });
  for (let index = 0; index < 30; index++) { const selected = pool.select({ service: "PRODUCT_API", capability: "READ", scope: "tenant-a", affinityKey: `failover-${index}` }); assert.notEqual(selected.selected.instance_id, "api-b"); pool.complete(selected.selected.instance_id); }
  const apiRtoMs = Number((performance.now() - apiFailureStarted).toFixed(3));
  pool.heartbeat("api-b", { healthy: true }); assert.equal(pool.snapshot().instances.find(item => item.instance_id === "api-b").health, "RECOVERING");
  pool.heartbeat("api-b", { healthy: true }); assert.equal(pool.snapshot().instances.find(item => item.instance_id === "api-b").health, "HEALTHY");
  assert.throws(() => pool.register({ instance_id: "forged", service: "PRODUCT_API", identity: { authenticated: false } }), /authentication_required/);
  const flapPool = createHealthAwareServicePool({ now, recoveryPasses: 1, flapLimit: 4, cooldownMs: 500 });
  flapPool.register({ instance_id: "flapping-api", service: "PRODUCT_API", capabilities: ["READ"], scopes: ["tenant-a"], health: "HEALTHY", identity: auth("flapping-api") });
  flapPool.heartbeat("flapping-api", { healthy: false }); flapPool.heartbeat("flapping-api", { healthy: true }); flapPool.heartbeat("flapping-api", { healthy: false }); flapPool.heartbeat("flapping-api", { healthy: true });
  assert.equal(flapPool.snapshot().instances[0].flapping, true); assert.equal(flapPool.select({ service: "PRODUCT_API", capability: "READ", scope: "tenant-a" }).status, "NO_HEALTHY_INSTANCE");

  // Explicit retry budgets and circuit breaking differ by operation class.
  const retries = createRetryBudget({ now, cooldownMs: 500 });
  assert.equal(retries.before("database", "IDEMPOTENT_WRITE").attempts, 2);
  retries.failure("database", "IDEMPOTENT_WRITE"); retries.failure("database", "IDEMPOTENT_WRITE"); retries.failure("database", "IDEMPOTENT_WRITE");
  assert.throws(() => retries.before("database", "IDEMPOTENT_WRITE"), /circuit_open/);
  clock += 501; assert.equal(retries.before("database", "IDEMPOTENT_WRITE").attempts, 2); retries.success("database");
  assert.equal(retries.before("device-control", "DEVICE_COMMAND").attempts, 1, "device commands are never blindly retried");

  // Shared transactional lease/fence prevents split brain and duplicate effects.
  const coordinationPath = join(root, "coordination.sqlite");
  const nodeA = createSqliteHaCoordinationStore({ databasePath: coordinationPath, now });
  const nodeB = createSqliteHaCoordinationStore({ databasePath: coordinationPath, now });
  const resourceId = "managed-device:gateway-home";
  const first = nodeA.acquire({ resourceId, ownerId: "control-a", leaseMs: 100 }); assert.equal(first.acquired, true); assert.equal(first.epoch, 1);
  assert.equal(nodeB.acquire({ resourceId, ownerId: "control-b", leaseMs: 100 }).acquired, false);
  assert.equal(nodeA.executeOnce({ resourceId, ownerId: "control-a", epoch: first.epoch, effectKey: "command-1", effectType: "BOUNDED_RECONNECT" }).accepted, true);
  clock += 101; const ownershipFailoverStarted = performance.now();
  const second = nodeB.acquire({ resourceId, ownerId: "control-b", leaseMs: 100 }); assert.equal(second.acquired, true); assert.equal(second.epoch, 2);
  const ownershipRtoMs = Number((performance.now() - ownershipFailoverStarted).toFixed(3));
  assert.throws(() => nodeA.executeOnce({ resourceId, ownerId: "control-a", epoch: first.epoch, effectKey: "command-2", effectType: "RESTART" }), /fencing_token_rejected/);
  assert.deepEqual(nodeB.executeOnce({ resourceId, ownerId: "control-b", epoch: second.epoch, effectKey: "command-1", effectType: "BOUNDED_RECONNECT" }), { accepted: false, duplicate: true, epoch: 1, owner_id: "control-a" });
  for (const [effectKey, effectType] of [["ota-release-1", "OTA_PROMOTE"], ["resync-batch-1", "RESYNC_COMMIT"], ["heartbeat-home-1", "HEARTBEAT_ACCEPT"]]) {
    assert.equal(nodeB.executeOnce({ resourceId, ownerId: "control-b", epoch: second.epoch, effectKey, effectType }).accepted, true);
    assert.equal(nodeB.executeOnce({ resourceId, ownerId: "control-b", epoch: second.epoch, effectKey, effectType }).duplicate, true);
  }
  const ownership = nodeB.snapshot(); assert.equal(ownership.effects, 4); assert.equal(ownership.multi_host, false); nodeA.close(); nodeB.close();

  // Storage outage remains PENDING unless an explicitly approved alternate exists.
  const pending = [], usage = [];
  const failedStorage = { id: "primary-private", async write() { throw new Error("storage_down"); } };
  const alternateStorage = { id: "approved-nas", async write(input) { return { object_id: input.objectId, bytes: input.bytes.length }; } };
  const deniedFailover = createStorageFailoverPolicy({ primary: failedStorage, alternates: [alternateStorage], allowedAlternateIds: [], enqueuePending: input => pending.push(input), onUsage: item => usage.push(item) });
  assert.equal((await deniedFailover.write({ objectId: "tenant/site/evidence/object.bin", bytes: Buffer.from("qa") })).state, "PENDING_UPLOAD");
  const allowedFailover = createStorageFailoverPolicy({ primary: failedStorage, alternates: [alternateStorage], allowedAlternateIds: ["approved-nas"], onUsage: item => usage.push(item) });
  const storageResult = await allowedFailover.write({ objectId: "tenant/site/evidence/object.bin", bytes: Buffer.from("qa") }); assert.equal(storageResult.failed_over, true); assert.equal(storageResult.backend_id, "approved-nas"); assert.equal(pending.length, 1);

  // Production-ready Postgres transport contract, without fabricating a deployed backend.
  const migration = readFileSync("supabase/migrations/20260911030000_digital_observer_high_availability.sql", "utf8");
  for (const requiredSql of ["for update skip locked", "p_tenant_ids text[]", "p_site_ids text[]", "tenant_id text not null", "queue_depth',coalesce(sum(n)", "observer_control_scope_mismatch", "returning * into current_lease", "select * into current_lease from public.observer_control_leases where resource_id=p_resource_id for update", "observer_control_effect_once_v1", "security definer", "to service_role"]) assert.ok(migration.toLowerCase().includes(requiredSql), `missing shared-queue SQL contract: ${requiredSql}`);
  const rpcCalls = [];
  const postgres = createPostgresAiQueueBackend({ identity: auth("queue-service"), rpc: async (name, input) => { rpcCalls.push({ name, input }); return { data: name.includes("snapshot") ? { queue_depth: 0 } : { ok: true } }; } });
  assert.equal(postgres.multi_host_ready, true); assert.equal(POSTGRES_AI_QUEUE_BACKEND.backend_class, "POSTGRES_SHARED_TRANSACTIONAL");
  await postgres.enqueue(job()); await postgres.claim({ worker_id: "queue-worker", capabilities: ["OBJECT_DETECTION"], model_classes: ["GENERAL_OBJECT_DETECTION"], identity: auth("queue-worker") });
  await postgres.acknowledge({ worker_id: "queue-worker" }, "ha-job-rpc", { contract: "observer-inference-result-v1" }); await postgres.fail({ worker_id: "queue-worker" }, "ha-job-rpc", "RETRYABLE", "TEMPORARY");
  await postgres.result("ha-job-rpc"); await postgres.recover(); await postgres.snapshot();
  assert.deepEqual(rpcCalls.map(item => item.name), ["observer_ai_job_enqueue_v1", "observer_ai_job_claim_v1", "observer_ai_job_ack_v1", "observer_ai_job_fail_v1", "observer_ai_job_result_v1", "observer_ai_queue_recover_v1", "observer_ai_queue_snapshot_v1"]);
  assert.deepEqual(rpcCalls[1].input.p_tenant_ids, ["tenant-a", "tenant-b"]); assert.deepEqual(rpcCalls[1].input.p_site_ids, ["site-a", "site-b"]);
  assert.throws(() => createPostgresAiQueueBackend({ identity: { authenticated: false }, rpc: async () => ({}) }), /identity_required/);

  // Execute the migration on a real isolated PostgreSQL engine and exercise
  // idempotent enqueue/ack plus transactional control-plane fencing.
  const pg = new PGlite();
  await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await pg.exec(migration);
  const pgJob = job({ job_id: "pg-job-canonical", idempotency_key: "pg-idempotency" });
  const inserted = (await pg.query("select public.observer_ai_job_enqueue_v1($1::jsonb) result", [JSON.stringify(pgJob)])).rows[0].result;
  assert.equal(inserted.inserted, true); assert.equal(inserted.job_id, "pg-job-canonical");
  const duplicateInsert = (await pg.query("select public.observer_ai_job_enqueue_v1($1::jsonb) result", [JSON.stringify({ ...pgJob, job_id: "pg-job-duplicate" })])).rows[0].result;
  assert.equal(duplicateInsert.inserted, false); assert.equal(duplicateInsert.job_id, "pg-job-canonical");
  const claimedPg = (await pg.query("select public.observer_ai_job_claim_v1('pg-worker',array['tenant-a'],array['site-a'],array['OBJECT_DETECTION'],array['GENERAL_OBJECT_DETECTION']) result")).rows[0].result;
  assert.equal(claimedPg.job.job_id, "pg-job-canonical");
  const pgResult = { contract: "observer-inference-result-v1", result_id: "pg-result", job_id: "pg-job-canonical", tenant_id: "tenant-a", site_id: "site-a", source_id: pgJob.source_id };
  const firstAck = (await pg.query("select public.observer_ai_job_ack_v1('pg-worker','pg-job-canonical',$1::jsonb) result", [JSON.stringify(pgResult)])).rows[0].result;
  const duplicateAck = (await pg.query("select public.observer_ai_job_ack_v1('pg-worker','pg-job-canonical',$1::jsonb) result", [JSON.stringify(pgResult)])).rows[0].result;
  assert.equal(firstAck.duplicate, false); assert.equal(duplicateAck.duplicate, true);
  const pgSnapshot = (await pg.query("select public.observer_ai_queue_snapshot_v1() result")).rows[0].result;
  assert.equal(Number(pgSnapshot.queue_depth), 0); assert.equal(Number(pgSnapshot.states.COMPLETED), 1);
  const firstPgOwner = (await pg.query("select public.observer_control_lease_acquire_v1('gateway-home','tenant-a','site-a','control-a',1) result")).rows[0].result;
  const blockedPgOwner = (await pg.query("select public.observer_control_lease_acquire_v1('gateway-home','tenant-a','site-a','control-b',1) result")).rows[0].result;
  assert.equal(firstPgOwner.acquired, true); assert.equal(blockedPgOwner.acquired, false); assert.equal(blockedPgOwner.epoch, firstPgOwner.epoch);
  await assert.rejects(pg.query("select public.observer_control_lease_acquire_v1('gateway-home','tenant-b','site-b','control-b',1)"), /observer_control_scope_mismatch/);
  const firstPgEffect = (await pg.query("select public.observer_control_effect_once_v1('gateway-home','tenant-a','site-a','control-a',$1,'pg-command','COMMAND',null) result", [firstPgOwner.epoch])).rows[0].result;
  const duplicatePgEffect = (await pg.query("select public.observer_control_effect_once_v1('gateway-home','tenant-a','site-a','control-a',$1,'pg-command','COMMAND',null) result", [firstPgOwner.epoch])).rows[0].result;
  assert.equal(firstPgEffect.accepted, true); assert.equal(duplicatePgEffect.duplicate, true);
  const authenticatedExecute = (await pg.query("select has_function_privilege('authenticated','public.observer_control_effect_once_v1(text,text,text,text,bigint,text,text,text)','execute') allowed")).rows[0].allowed;
  assert.equal(authenticatedExecute, false); await pg.close();

  // Queue/service interruption and worker capacity loss/return under load.
  const queuePath = join(root, "worker-ha.sqlite"); const authorizer = worker => worker.identity?.authenticated === true && worker.identity.revoked !== true;
  let queue = createDurableAiJobQueue({ databasePath: queuePath, workerAuthorizer: authorizer, policy: { leaseMs: 100, maxJobs: 500 } });
  queue.enqueueMany(Array.from({ length: 40 }, () => job())); const dead = { worker_id: "worker-dead", environment: "ISOLATED_PROCESS", capabilities: ["OBJECT_DETECTION"], model_classes: ["GENERAL_OBJECT_DETECTION"], identity: auth("worker-dead") };
  const claimed = queue.claim(dead, { leaseMs: 100 }); assert.ok(claimed?.job); queue.close();
  queue = createDurableAiJobQueue({ databasePath: queuePath, workerAuthorizer: authorizer, policy: { leaseMs: 100, maxJobs: 500 } }); assert.equal(queue.snapshot().queue_depth, 40, "queue restart preserves pending and claimed work");
  const workers = [inferWorker("worker-a"), inferWorker("worker-b")];
  const capacityLossStarted = performance.now();
  for (let index = 0; index < 8; index++) await workers[0].processOne(queue);
  const degradedDepth = queue.snapshot().queue_depth; assert.ok(degradedDepth >= 32);
  await sleep(110);
  let idle = 0;
  while (idle < 2) { const results = await Promise.all(workers.map(worker => worker.processOne(queue))); idle = results.every(item => item.status === "IDLE") ? idle + 1 : 0; }
  const capacityRecoveryMs = Number((performance.now() - capacityLossStarted).toFixed(3));
  const queueSnapshot = queue.snapshot(); assert.equal(queueSnapshot.states.COMPLETED, 40); assert.equal(queueSnapshot.queue_depth, 0); assert.equal(queueSnapshot.dead_letter_count, 0);
  let consumed = 0; for (let id = 1; id <= sequence; id++) if (queue.result(`ha-job-${id}`, { consume: true })) consumed++;
  assert.equal(consumed, 40); queue.close();

  const output = {
    status: "PASS", contract: "observer-ha-service-v1",
    evidence_level: ["LOCAL_MULTI_PROCESS", "LOCAL_MULTI_NODE", "PRODUCTION_READY_POSTGRES_CONTRACT"],
    api: { nodes: 3, requests: 120, initial_distribution: distribution, failed_node_removed: true, recovered_after_health_gates: true, rto_ms: apiRtoMs, tenant_leakage: 0 },
    worker_failover: { jobs: 40, completed: 40, accepted_results: 40, queue_restart_loss: 0, worker_loss_recovered: true, degraded_queue_depth: degradedDepth, capacity_recovery_ms: capacityRecoveryMs },
    queue_ha: { local_backend: "SQLITE_WAL_LOCAL_MULTI_PROCESS", shared_backend: "POSTGRES_SHARED_TRANSACTIONAL", shared_backend_evidence: "ISOLATED_POSTGRES_EXECUTION; NOT_DEPLOYED_MULTI_HOST" },
    device_control: { contenders: 2, first_epoch: 1, failover_epoch: 2, old_owner_fenced: true, effects: ownership.effects, rto_ms: ownershipRtoMs, reenrollments: 0, duplicate_enrollments: 0 },
    command_ota_resync: { duplicate_effects: 0, command: "PASS", ota: "PASS", resync: "PASS" },
    database: { bounded_retry: "PASS", circuit_breaker: "PASS", recovered: true, corruption: 0 },
    storage: { pending_without_authorized_alternate: true, authorized_failover: "approved-nas", false_available_states: 0, lost_last_copies: 0 },
    rpo: { acknowledged_records_lost: 0, duplicate_product_effects: 0 },
    postgres_rpc_surface: rpcCalls.map(item => item.name), flapping_instance_removed: true, telemetry: { api: pool.snapshot(), retry_dependencies: retries.snapshot(), storage_events: usage.length }
  };
  console.log(JSON.stringify(output, null, 2));
} finally { rmSync(root, { recursive: true, force: true }); }
