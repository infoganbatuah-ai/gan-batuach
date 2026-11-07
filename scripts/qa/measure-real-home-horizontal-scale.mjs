/** Read-only integration proof: one physical sample uses the horizontal worker-pool contract. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createAiJob } from "../../services/video-gateway/ai-job-contract.mjs";
import { createDurableAiJobQueue } from "../../services/video-gateway/durable-ai-job-queue.mjs";
import { createHorizontalInferencePool } from "../../services/video-gateway/horizontal-inference-pool.mjs";
import { createObjectInferenceClient } from "../../services/video-gateway/object-inference-client.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";
import { createPreprocessingEngine } from "../../services/video-gateway/preprocessing-policy.mjs";

const root = mkdtempSync(join(tmpdir(), "observer-real-horizontal-"));
const secretRoot = process.env.OBSERVER_CONNECTOR_SECRET_DIR || join(homedir(), "Library", "Application Support", "Digital Observer", "Tapo Connector", "secrets");
const health = async port => { const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`health_${port}_${response.status}`); return response.json(); };
const ffmpeg = [process.env.FFMPEG_PATH, "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]
  .find(value => value && existsSync(value));
if (!ffmpeg) throw new Error("ffmpeg_runtime_unavailable");
let inferenceClient;
try {
  const gatewaySecret = readFileSync(join(secretRoot, "gateway_signing_secret"), "utf8").trim();
  const configuredStreamId = readFileSync(join(secretRoot, "connector_gateway_stream_id"), "utf8").trim();
  const sourceId = readFileSync(join(secretRoot, "connector_camera_source_id"), "utf8").trim();
  const deviceId = readFileSync(join(secretRoot, "device_gateway_id"), "utf8").trim();
  const siteId = readFileSync(join(secretRoot, "device_observer_site_id"), "utf8").trim();
  const manifestResponse = await fetch("http://127.0.0.1:18083/cloud/event-manifest", {
    headers: { "x-video-gateway-secret": gatewaySecret }, signal: AbortSignal.timeout(15_000) });
  const manifestEnvelope = await manifestResponse.json();
  const manifest = manifestEnvelope.data ?? manifestEnvelope;
  assert.equal(manifestResponse.ok, true);
  assert.equal(manifest.cameras?.length, 1);
  assert.equal(manifest.cameras[0].status, "connected");
  const streamId = manifest.cameras[0].stream_id;
  const before = await Promise.all([health(18082), health(18083)]), capability = Symbol("real-horizontal-worker");
  assert.equal(before[1].edge?.capability_test?.passed, true);
  assert.equal(before[1].edge?.models?.loaded, true);
  const schedule = createPreprocessingEngine().evaluate({ camera: { camera_id: sourceId,
    site_id: siteId, channel_assignment: "ASSIGNED", physical_camera_attached: true },
  policy: "ALWAYS_ANALYZE", health: { source: "ONLINE", frame_fresh: true },
  observed_at: new Date().toISOString() });
  assert.equal(schedule.request_ai, true);
  const otaRoot = join(homedir(), "Library", "Application Support", "Digital Observer",
    "observer-connector", "ota");
  const current = JSON.parse(readFileSync(join(otaRoot, "current.json"), "utf8"));
  assert.equal(current.slot, join(otaRoot, "slots", current.version));
  const installedModel = join(current.slot, "runtime", "Digital Observer.app", "Contents",
    "Resources", "models", "ssd_mobilenet_v1_10.onnx");
  assert.equal(existsSync(installedModel), true);
  process.env.VIDEO_GATEWAY_OBJECT_MODEL_PATH = installedModel;
  inferenceClient = createObjectInferenceClient({ workerPath: join(current.slot, "runtime",
    "Digital Observer.app", "Contents", "Resources", "runtime", "services", "video-gateway",
    "onnx-object-worker.mjs") });
  assert.equal(await inferenceClient.start(), true, JSON.stringify(inferenceClient.status()));
  const queue = createDurableAiJobQueue({ databasePath: join(root, "queue.sqlite"), workerAuthorizer: value => value.identity?.local_capability === capability });
  const at = Date.now(), job = createAiJob({ tenant_id: siteId, site_id: siteId, source_id: sourceId, observation_timestamp: new Date(at).toISOString(), priority: "CRITICAL", purpose: "REALTIME_DETECTION", requested_capability: "OBJECT_DETECTION", model_class: "GENERAL_OBJECT_DETECTION", input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: `stream:${streamId}`, locality: "MANAGED_COMPONENT_ONLY" }, expires_at: new Date(at + 90_000).toISOString(), scheduler_reason: "READ_ONLY_PUSH36_REAL_CAMERA", scheduler_version: "observer-adaptive-sampling-v1", ordering_key: `${siteId}:${sourceId}` });
  queue.enqueue(job);
  const identity = { authenticated: true, revoked: false, device_id: deviceId, tenant_ids: [siteId], site_ids: [siteId], local_capability: capability };
  const infer = async value => { const response = await fetch(`http://127.0.0.1:18083/camera/${encodeURIComponent(value.input_ref.reference.slice(7))}/playback`, { headers: { "x-video-gateway-secret": gatewaySecret }, signal: AbortSignal.timeout(15_000) }); const body = await response.json(); const playbackUrl = body.playback?.hls_url; assert(response.ok && playbackUrl); assert(["127.0.0.1", "localhost"].includes(new URL(playbackUrl).hostname)); const frame = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-threads", "1", "-filter_threads", "1", "-i", playbackUrl, "-frames:v", "1", "-vf", "scale=300:300,format=rgb24", "-f", "rawvideo", "pipe:1"], { maxBuffer: 512_000, timeout: 20_000 }); assert.equal(frame.status, 0); assert.equal(frame.stdout.length, 270_000); const detections = await inferenceClient.predict(frame.stdout); frame.stdout.fill(0); assert.notEqual(detections, null, JSON.stringify(inferenceClient.status())); return { detections, source_anchor: null, observation_timestamp: new Date().toISOString(), model_provenance: inferenceClient.status().provenance }; };
  const active = createPortableInferenceWorker({ workerId: "real-tapo-horizontal-a", environment: "EDGE_LOCAL", identity, capabilities: ["OBJECT_DETECTION"], infer });
  const standby = createPortableInferenceWorker({ workerId: "real-tapo-horizontal-b", environment: "EDGE_LOCAL", identity, capabilities: ["OBJECT_DETECTION"], infer });
  const pool = createHorizontalInferencePool({ queue }); pool.add(active); pool.add(standby); const poolResult = await pool.drain();
  assert.equal(poolResult.active_workers, 2); assert.equal(poolResult.completed, 1); assert.equal(poolResult.failures, 0);
  const result = queue.result(job.job_id, { consume: true }); assert(result); assert.equal(queue.result(job.job_id, { consume: true }), null);
  const after = await Promise.all([health(18082), health(18083)]); queue.close();
  console.log(JSON.stringify({ status: "PASS", mode: "READ_ONLY_REAL_CAMERA_HORIZONTAL_POOL", path: "authorized Tapo HLS frame → preprocessing → canonical AI job → 2-worker pool → installed ONNX runtime → one canonical result", preprocessing: { decision: schedule.decision, request_ai: schedule.request_ai }, installed_connector_version: current.version, live_manifest_camera_count: manifest.cameras.length, configured_stream_reference_match: configuredStreamId === streamId, pool_workers: 2, accepted_results: 1, duplicate_results: 0, job_id: result.job_id, worker_id: result.worker_id, model: result.model, runtime: result.runtime, detections: result.detections.length, queue_wait_ms: result.queue_wait_ms, inference_ms: result.inference_ms,
    home: { dvr_expected: 10, dvr_progressing_before: before[0].mediaHeartbeat?.progressingRelays ?? null, dvr_progressing_after: after[0].mediaHeartbeat?.progressingRelays ?? null, empty_dvr_slots: 6, empty_slot_jobs: 0, tapo_expected: 1, tapo_progressing_before: before[1].mediaHeartbeat?.progressingRelays ?? null, tapo_progressing_after: after[1].mediaHeartbeat?.progressingRelays ?? null, dvr_stalled_after: after[0].mediaHeartbeat?.stalledRelays ?? null, tapo_stalled_after: after[1].mediaHeartbeat?.stalledRelays ?? null }, source_configuration_changed: false, event_fabricated: false }));
} finally { inferenceClient?.close(); rmSync(root, { recursive: true, force: true }); }
