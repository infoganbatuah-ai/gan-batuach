/** Read-only integration proof: one physical sample uses the horizontal worker-pool contract. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createAiJob } from "../../services/video-gateway/ai-job-contract.mjs";
import { createDurableAiJobQueue } from "../../services/video-gateway/durable-ai-job-queue.mjs";
import { createHorizontalInferencePool } from "../../services/video-gateway/horizontal-inference-pool.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";

const root = mkdtempSync(join(tmpdir(), "observer-real-horizontal-"));
const secretRoot = process.env.OBSERVER_CONNECTOR_SECRET_DIR || join(homedir(), "Library", "Application Support", "Digital Observer", "Tapo Connector", "secrets");
const health = async port => { const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`health_${port}_${response.status}`); return response.json(); };
try {
  const gatewaySecret = readFileSync(join(secretRoot, "gateway_signing_secret"), "utf8").trim();
  const streamId = readFileSync(join(secretRoot, "connector_gateway_stream_id"), "utf8").trim();
  const sourceId = readFileSync(join(secretRoot, "connector_camera_source_id"), "utf8").trim();
  const deviceId = readFileSync(join(secretRoot, "device_gateway_id"), "utf8").trim();
  const siteId = readFileSync(join(secretRoot, "device_observer_site_id"), "utf8").trim();
  const before = await Promise.all([health(18082), health(18083)]), capability = Symbol("real-horizontal-worker");
  const queue = createDurableAiJobQueue({ databasePath: join(root, "queue.sqlite"), workerAuthorizer: value => value.identity?.local_capability === capability });
  const at = Date.now(), job = createAiJob({ tenant_id: siteId, site_id: siteId, source_id: sourceId, observation_timestamp: new Date(at).toISOString(), priority: "CRITICAL", purpose: "REALTIME_DETECTION", requested_capability: "OBJECT_DETECTION", model_class: "GENERAL_OBJECT_DETECTION", input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: `stream:${streamId}`, locality: "MANAGED_COMPONENT_ONLY" }, expires_at: new Date(at + 90_000).toISOString(), scheduler_reason: "READ_ONLY_PUSH36_REAL_CAMERA", scheduler_version: "observer-adaptive-sampling-v1", ordering_key: `${siteId}:${sourceId}` });
  queue.enqueue(job);
  const identity = { authenticated: true, revoked: false, device_id: deviceId, tenant_ids: [siteId], site_ids: [siteId], local_capability: capability };
  const infer = async value => { const response = await fetch(`http://127.0.0.1:18083/camera/${encodeURIComponent(value.input_ref.reference.slice(7))}/detections`, { headers: { "x-video-gateway-secret": gatewaySecret }, signal: AbortSignal.timeout(75_000) }); const body = await response.json(); if (!response.ok || body.insight?.object_detection?.status !== "sampled") throw new Error("real_detector_unavailable"); return { detections: body.insight.object_detection.detections, source_anchor: body.insight.source_anchor, observation_timestamp: body.insight.sampled_at, model_provenance: body.insight.object_detection.model_provenance }; };
  const active = createPortableInferenceWorker({ workerId: "real-tapo-horizontal-a", environment: "EDGE_LOCAL", identity, capabilities: ["OBJECT_DETECTION"], infer });
  const standby = createPortableInferenceWorker({ workerId: "real-tapo-horizontal-b", environment: "EDGE_LOCAL", identity, capabilities: ["OBJECT_DETECTION"], infer: async () => { throw new Error("standby_should_not_receive_duplicate_job"); } });
  const pool = createHorizontalInferencePool({ queue }); pool.add(active); pool.add(standby); const poolResult = await pool.drain();
  assert.equal(poolResult.active_workers, 2); assert.equal(poolResult.completed, 1); assert.equal(poolResult.failures, 0);
  const result = queue.result(job.job_id, { consume: true }); assert(result); assert.equal(queue.result(job.job_id, { consume: true }), null);
  const after = await Promise.all([health(18082), health(18083)]); queue.close();
  console.log(JSON.stringify({ status: "PASS", mode: "READ_ONLY_REAL_CAMERA_HORIZONTAL_POOL", path: "Tapo C211 → canonical AI job → 2-worker pool → existing ONNX runtime → one canonical result", pool_workers: 2, accepted_results: 1, duplicate_results: 0, job_id: result.job_id, worker_id: result.worker_id, model: result.model, detections: result.detections.length, queue_wait_ms: result.queue_wait_ms, inference_ms: result.inference_ms,
    home: { dvr_expected: 10, dvr_progressing_before: before[0].mediaHeartbeat?.progressingRelays ?? null, dvr_progressing_after: after[0].mediaHeartbeat?.progressingRelays ?? null, empty_dvr_slots: 6, empty_slot_jobs: 0, tapo_expected: 1, tapo_progressing_before: before[1].mediaHeartbeat?.progressingRelays ?? null, tapo_progressing_after: after[1].mediaHeartbeat?.progressingRelays ?? null, dvr_stalled_after: after[0].mediaHeartbeat?.stalledRelays ?? null, tapo_stalled_after: after[1].mediaHeartbeat?.stalledRelays ?? null }, source_configuration_changed: false, event_fabricated: false }));
} finally { rmSync(root, { recursive: true, force: true }); }
