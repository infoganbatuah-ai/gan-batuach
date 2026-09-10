/** Read-only bounded real-input workload comparison. It never changes sources, rules or thresholds. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createPreprocessingEngine } from "../../services/video-gateway/preprocessing-policy.mjs";

const dvrBase = "http://127.0.0.1:18082";
const connectorBase = "http://127.0.0.1:18083";
const gatewayService = "com.ganbatuach.video-gateway.runtime";
const connectorSecretRoot = process.env.OBSERVER_CONNECTOR_SECRET_DIR || join(homedir(), "Library", "Application Support", "Digital Observer", "Tapo Connector", "secrets");
const gatewaySecret = execFileSync("/usr/bin/security", ["find-generic-password", "-s", gatewayService, "-a", "gateway_signing_secret", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const profile = JSON.parse(execFileSync("/usr/bin/security", ["find-generic-password", "-s", gatewayService, "-a", "dvr_profile_json", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const connectorSecret = readFileSync(`${connectorSecretRoot}/gateway_signing_secret`, "utf8").trim();
const connectorStream = readFileSync(`${connectorSecretRoot}/connector_gateway_stream_id`, "utf8").trim();
const siteId = readFileSync(`${connectorSecretRoot}/device_observer_site_id`, "utf8").trim();
const host = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`).hostname;
const streamNamespace = String(profile.metadata?.stream_namespace || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
const populated = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
const sources = populated.map(channel => ({ kind: "DVR", id: `dvr_${createHash("sha256").update([profile.connection_type || "dvr", host, channel, streamNamespace].join(":")).digest("hex").slice(0, 18)}_${channel}`, channel, base: dvrBase, secret: gatewaySecret }))
  .concat([{ kind: "TAPO", id: connectorStream, channel: 1, base: connectorBase, secret: connectorSecret }]);
assert.equal(sources.length, 11);

async function insight(source) {
  const started = Date.now();
  try {
    const response = await fetch(`${source.base}/camera/${encodeURIComponent(source.id)}/insights`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(45_000) });
    const body = await response.json();
    if (!response.ok || body.local_processing !== true || body.no_raw_video_returned !== true || !Number.isFinite(body.insight?.motion_score)) return { source, ok: false, elapsedMs: Date.now() - started,
      failure: !response.ok ? `HTTP_${response.status}` : body.local_processing !== true ? "LOCAL_PROCESSING_FALSE" : body.no_raw_video_returned !== true ? "RAW_VIDEO_CONTRACT_FALSE" : "MOTION_SCORE_UNAVAILABLE" };
    return { source, ok: true, elapsedMs: Date.now() - started, motionScore: body.insight.motion_score,
      detectorSampled: body.insight.object_detection?.status === "sampled", detections: Array.isArray(body.insight.object_detection?.detections) ? body.insight.object_detection.detections.length : 0,
      observedAt: body.insight.sampled_at };
  } catch (error) { return { source, ok: false, elapsedMs: Date.now() - started,
    failure: error?.name === "TimeoutError" ? "TIMEOUT" : "REQUEST_FAILED" }; }
}

async function boundedMap(items, worker, concurrency = 2) {
  let cursor = 0; const output = [];
  await Promise.all(Array.from({ length: concurrency }, async () => { while (cursor < items.length) output.push(await worker(items[cursor++])); }));
  return output;
}

const startedAt = Date.now();
const rounds = [];
for (let round = 0; round < 2; round++) rounds.push(await boundedMap(sources, insight, 2));
const successful = rounds.flat().filter(item => item.ok);
const detectorSamples = successful.filter(item => item.detectorSampled);
let policyClock = Date.parse("2026-09-10T12:00:00.000Z");
const engine = createPreprocessingEngine({ now: () => policyClock, motionThreshold: 0.025, maxQuietIntervalMs: 30_000, coalesceWindowMs: 5_000 });
for (let round = 0; round < rounds.length; round++) {
  policyClock += round === 0 ? 0 : 1_000;
  for (const item of rounds[round].filter(value => value.ok)) engine.evaluate({ camera: { camera_id: item.source.id, site_id: siteId, channel_assignment: "ASSIGNED", physical_camera_attached: true },
    policy: "ADAPTIVE", health: { source: "ONLINE", frame_fresh: true }, motion_score: item.motionScore, observed_at: new Date(policyClock).toISOString() });
}
const emptyEngine = createPreprocessingEngine({ now: () => policyClock });
for (let channel = 0; channel < 6; channel++) emptyEngine.evaluate({ camera: { camera_id: `empty-${channel}`, site_id: siteId, channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false }, policy: "ADAPTIVE" });
const optimized = engine.snapshot();
const health = await Promise.all([fetch(`${dvrBase}/health`).then(r => r.json()), fetch(`${connectorBase}/health`).then(r => r.json())]);
// Baseline work is an inference request, whether or not the detector returns a
// sampled result. This keeps the cost denominator independent of model health.
const baselineJobs = successful.length;
const avoided = Math.max(0, baselineJobs - optimized.expensive_ai_jobs_requested);
console.log(JSON.stringify({ status: successful.length === 22 ? "PASS" : "PARTIAL", mode: "READ_ONLY_REAL_INPUT_REPLAY",
  duration_ms: Date.now() - startedAt, rounds: 2, physical_cameras: 11, samples_requested: 22, successful_real_samples: successful.length,
  successful_detector_samples: detectorSamples.length,
  baseline: { frames_samples: successful.length, expensive_ai_jobs: baselineJobs },
  optimized: { frames_cheaply_evaluated: optimized.frames_cheaply_evaluated, candidates: optimized.candidates_produced,
    expensive_ai_jobs: optimized.expensive_ai_jobs_requested, jobs_avoided: avoided, reduction: baselineJobs ? avoided / baselineJobs : null,
    fallback_events: optimized.fallback_events },
  dvr: { cameras: 10, successful_samples: successful.filter(item => item.source.kind === "DVR").length, native_metadata: "NOT_VERIFIED", fallback: "LOCAL_FRAME_DIFF",
    progressing: health[0].mediaHeartbeat?.progressingRelays ?? null, stalled: health[0].mediaHeartbeat?.stalledRelays ?? null,
    failures: Object.fromEntries(rounds.flat().filter(item => item.source.kind === "DVR" && !item.ok).reduce((counts, item) => counts.set(item.failure, (counts.get(item.failure) || 0) + 1), new Map())) },
  tapo: { cameras: 1, successful_samples: successful.filter(item => item.source.kind === "TAPO").length, native_metadata: "NOT_VERIFIED", fallback: "LOCAL_FRAME_DIFF",
    progressing: health[1].mediaHeartbeat?.progressingRelays ?? null, stalled: health[1].mediaHeartbeat?.stalledRelays ?? null },
  empty_slots: { count: 6, ai_work: emptyEngine.snapshot().expensive_ai_jobs_requested }, raw_frames_logged: false, source_configuration_changed: false }, null, 2));
