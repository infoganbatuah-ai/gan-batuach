import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAiJob } from "../../services/video-gateway/ai-job-contract.mjs";
import { createDurableAiJobQueue } from "../../services/video-gateway/durable-ai-job-queue.mjs";
import { createExecutionTarget } from "../../services/video-gateway/ai-routing-policy.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";
import { COST_USAGE_CONTRACT, allocateSharedUsage, assertCostOptimizationSafety, buildCostReport, createCostUsage, createInferenceCostUsage, createRateCatalog, detectCostAnomalies, projectUsage, reconcileProviderCost } from "../../services/video-gateway/cost-intelligence.mjs";

const root = mkdtempSync(join(tmpdir(), "observer-cost-engine-"));
const capability = Symbol("cost-qa");
const now = Date.parse("2026-09-10T12:00:00.000Z");
const catalog = createRateCatalog({ catalog_id: "qa-measured-rates", version: "2026-09-10.1", currency: "USD", effective_at: "2026-01-01T00:00:00.000Z", rates: [
  { rate_id: "qa-ai-ms", provider_id: "digital-observer-managed", resource_type: "AI_INFERENCE", unit: "MILLISECOND", currency: "USD", unit_cost: 0.000002, quality: "DIRECTLY_METERED", source: "DETERMINISTIC_QA_RATE_NOT_PROVIDER_PRICE" },
  { rate_id: "qa-hosting-request", provider_id: "qa-platform", resource_type: "PLATFORM_HOSTING", unit: "REQUEST", currency: "USD", unit_cost: 0.001, quality: "ESTIMATED", source: "DETERMINISTIC_QA_ASSUMPTION" }
] });

const job = createAiJob({ tenant_id: "11111111-1111-4111-8111-111111111111", site_id: "22222222-2222-4222-8222-222222222222", source_id: "33333333-3333-4333-8333-333333333333",
  observation_timestamp: new Date(now).toISOString(), priority: "HIGH", purpose: "REALTIME_DETECTION", requested_capability: "OBJECT_DETECTION", model_class: "GENERAL_OBJECT_DETECTION",
  input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: "qa:sample", locality: "MANAGED_COMPONENT_ONLY" }, expires_at: new Date(now + 60_000).toISOString(), scheduler_reason: "COST_QA", scheduler_version: "observer-adaptive-sampling-v1" });
const target = createExecutionTarget({ target_id: "edge-cost-qa", target_class: "EDGE_LOCAL", environment: "EDGE_LOCAL", provider_id: "digital-observer-managed", region: "local",
  supported_capabilities: ["OBJECT_DETECTION"], supported_model_classes: ["GENERAL_OBJECT_DETECTION"], supported_input_kinds: ["GATEWAY_SOURCE_SAMPLE"], health: "HEALTHY", available: true,
  capacity: { max_concurrency: 1, in_flight: 0, queue_depth: 0 }, tenant_eligibility: { mode: "ALLOWLIST", tenant_ids: [job.tenant_id] }, privacy_eligibility: ["LOCAL_ALLOWED"], input_access: { locality: ["MANAGED_COMPONENT_ONLY"], source_ids: [job.source_id] },
  cost_hook: { measured: true, compute_class: "QA_CPU", bandwidth_class: "LOCAL_ONLY", accounting_key: "qa-edge" } });
const observed = [];
const queue = createDurableAiJobQueue({ databasePath: join(root, "cost.sqlite"), workerAuthorizer: worker => worker.identity?.local_capability === capability, now: () => now });
try {
  queue.enqueue(job);
  const worker = createPortableInferenceWorker({ workerId: target.target_id, environment: "EDGE_LOCAL", identity: { authenticated: true, revoked: false, device_id: "qa-device", tenant_ids: [job.tenant_id], site_ids: [job.site_id], local_capability: capability }, capabilities: ["OBJECT_DETECTION"], now: (() => { let value = now + 10; return () => (value += 250); })(),
    infer: async () => ({ detections: [], model_provenance: { model: "qa-model", expected_sha256: "qa-model-v1", runtime: "node" } }),
    usageObserver: async ({ job: completedJob, result }) => observed.push(createInferenceCostUsage(completedJob, result, target, { catalog })) });
  const completed = await worker.processOne(queue, { jobId: job.job_id, routeDecision: { selected_target_id: target.target_id, selected_target_class: target.target_class, decision_id: "route-cost-qa", policy_version: "observer-ai-routing-policy-v1", failover_history: [] } });
  assert.equal(completed.status, "COMPLETED"); assert.equal(observed.length, 1); assert.equal(observed[0].contract, COST_USAGE_CONTRACT);
  assert.equal(observed[0].quantity, 250); assert.equal(observed[0].calculated_cost, 0.0005); assert.equal(observed[0].ai_job_id, job.job_id);
  const telemetryFailureJob = createAiJob({ ...job, job_id: "aij_cost_telemetry_failure", source_id: "44444444-4444-4444-8444-444444444444", idempotency_key: "cost-telemetry-failure" });
  queue.enqueue(telemetryFailureJob);
  const isolatedMeterWorker = createPortableInferenceWorker({ workerId: target.target_id, environment: "EDGE_LOCAL", identity: { authenticated: true, revoked: false, device_id: "qa-device", tenant_ids: [job.tenant_id], site_ids: [job.site_id], local_capability: capability }, capabilities: ["OBJECT_DETECTION"], now: (() => { let value = now + 20; return () => (value += 100); })(),
    infer: async () => ({ detections: [], model_provenance: { model: "qa-model", expected_sha256: "qa-model-v1", runtime: "node" } }), usageObserver: async () => { throw new Error("controlled_cost_meter_failure"); } });
  assert.equal((await isolatedMeterWorker.processOne(queue, { jobId: telemetryFailureJob.job_id })).status, "COMPLETED");
  assert.equal(isolatedMeterWorker.snapshot().usage_observer_failures, 1);

  const unknown = createCostUsage({ provider_id: "unconfigured-provider", resource_type: "BANDWIDTH_EGRESS", unit: "BYTE", quantity: 4096, tenant_id: job.tenant_id, site_id: job.site_id,
    source_id: job.source_id, window_start: new Date(now).toISOString(), window_end: new Date(now + 1_000).toISOString(), currency: "USD", provenance: { meter: "QA_BYTES" } }, { catalog });
  assert.equal(unknown.calculated_cost, null); assert.equal(unknown.attribution_quality, "UNKNOWN");
  assert.throws(() => createCostUsage({ ...unknown, provenance: { access_token: "forbidden" } }), /secret_field/);

  const shared = createCostUsage({ provider_id: "qa-platform", resource_type: "PLATFORM_HOSTING", unit: "REQUEST", quantity: 11, tenant_id: job.tenant_id, site_id: job.site_id,
    window_start: new Date(now).toISOString(), window_end: new Date(now + 1_000).toISOString(), currency: "USD", idempotency_key: "shared-qa" }, { catalog });
  const physical = Array.from({ length: 11 }, (_, index) => ({ source_id: `physical-${index + 1}`, expected_physical_camera: true, state: "ONLINE" }))
    .concat(Array.from({ length: 6 }, (_, index) => ({ source_id: `empty-${index + 1}`, expected_physical_camera: false, state: "CHANNEL_EMPTY" })));
  const allocations = allocateSharedUsage(shared, physical); assert.equal(allocations.length, 11); assert.equal(allocations.some(row => row.source_id.startsWith("empty-")), false);
  assert.equal(Number(allocations.reduce((sum, row) => sum + row.calculated_cost, 0).toFixed(12)), shared.calculated_cost);

  const report = buildCostReport([...observed, unknown, ...allocations, observed[0]], { tenant_id: job.tenant_id });
  assert.equal(report.duplicate_events_ignored, 1); assert.equal(report.unknown_cost_events, 1); assert.equal(report.customer_price_included, false);
  assert.equal(buildCostReport([...observed], { tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }).usage_events, 0);
  const reconciliation = reconcileProviderCost(observed, { reconciliation_id: "recon-qa", provider_id: "digital-observer-managed", currency: "USD", actual_cost: 0.0005, approved_tolerance: 0 });
  assert.equal(reconciliation.status, "RECONCILED"); assert.equal(reconciliation.within_approved_tolerance, true);
  assert.equal(reconcileProviderCost([unknown], { provider_id: "unconfigured-provider", currency: "USD", actual_cost: 1 }).status, "NOT_RECONCILED");
  assert.deepEqual(projectUsage({ physical_camera_count: 10, observation_ms: 60_000, ai_jobs: 100, inference_ms: 25_000, known_cost_by_currency: { USD: 0.05 } }).map(row => row.ai_jobs), [100, 1000, 10000]);
  assert.equal(detectCostAnomalies({ AI_INFERENCE: 300 }, { AI_INFERENCE: 100 }).length, 1);
  assert.equal(assertCostOptimizationSafety({ targetEligible: true, privacyAllowed: true, qualityGatePassed: true }), true);
  assert.throws(() => assertCostOptimizationSafety({ targetEligible: true, privacyAllowed: false, qualityGatePassed: true }), /privacy_denied/);

  console.log(JSON.stringify({ status: "PASS", contract: COST_USAGE_CONTRACT, ai_cost_attribution: "VERIFIED", camera_site_tenant_attribution: "VERIFIED", rate_catalog: catalog.version,
    metered_cost: observed[0].calculated_cost, unknown_provider_cost: "NOT_RECONCILED", shared_allocation_denominator: allocations.length, empty_slot_camera_cost: 0,
    idempotency: "VERIFIED", tenant_filter: "VERIFIED", anomaly_foundation: "VERIFIED", metering_failure_isolated: "VERIFIED", quality_privacy_safety: "VERIFIED", billing_changed: false }));
} finally { queue.close(); rmSync(root, { recursive: true, force: true }); }
