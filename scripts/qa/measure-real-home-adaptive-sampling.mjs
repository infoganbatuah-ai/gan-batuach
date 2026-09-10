/** Read-only real-input measurement. No source, threshold, rule, or cloud state is changed. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createAdaptiveSamplingScheduler } from "../../services/video-gateway/adaptive-sampling-scheduler.mjs";
import { createPreprocessingEngine } from "../../services/video-gateway/preprocessing-policy.mjs";

const dvrBase = "http://127.0.0.1:18082", connectorBase = "http://127.0.0.1:18083";
const service = "com.ganbatuach.video-gateway.runtime";
const connectorRoot = process.env.OBSERVER_CONNECTOR_SECRET_DIR || join(homedir(), "Library", "Application Support", "Digital Observer", "Tapo Connector", "secrets");
const gatewaySecret = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", "gateway_signing_secret", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const profile = JSON.parse(execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", "dvr_profile_json", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const connectorSecret = readFileSync(`${connectorRoot}/gateway_signing_secret`, "utf8").trim();
const connectorStream = readFileSync(`${connectorRoot}/connector_gateway_stream_id`, "utf8").trim();
const siteId = readFileSync(`${connectorRoot}/device_observer_site_id`, "utf8").trim();
const host = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`).hostname;
const namespace = String(profile.metadata?.stream_namespace || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
const populated = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
const sources = populated.map(channel => ({ kind: "DVR", name: `DVR channel ${channel}`, id: `dvr_${createHash("sha256").update([profile.connection_type || "dvr", host, channel, namespace].join(":")).digest("hex").slice(0, 18)}_${channel}`, base: dvrBase, secret: gatewaySecret }))
  .concat([{ kind: "TAPO", name: "Tapo C211", id: connectorStream, base: connectorBase, secret: connectorSecret }]);
assert.equal(sources.length, 11);

async function activity(source) {
  const started = Date.now();
  try {
    let endpoint = "activity";
    let response = await fetch(`${source.base}/camera/${encodeURIComponent(source.id)}/activity`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(30_000) });
    if (response.status === 404) {
      endpoint = "legacy_insights_fallback";
      response = await fetch(`${source.base}/camera/${encodeURIComponent(source.id)}/insights`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(45_000) });
    }
    const body = await response.json();
    if (!response.ok || body.local_processing !== true || body.no_raw_video_returned !== true || !Number.isFinite(body.insight?.motion_score)) return { source, ok: false, elapsedMs: Date.now() - started, failure: `HTTP_OR_CONTRACT_${response.status}` };
    return { source, ok: true, endpoint, elapsedMs: Date.now() - started, motionScore: body.insight.motion_score, sampledAt: body.insight.sampled_at };
  } catch (error) { return { source, ok: false, elapsedMs: Date.now() - started, failure: error?.name === "TimeoutError" ? "TIMEOUT" : "REQUEST_FAILED" }; }
}

const startedAt = Date.now();
const realInputs = [];
for (const source of sources) realInputs.push(await activity(source));
const successful = realInputs.filter(item => item.ok);
let clock = Date.parse("2026-09-10T14:00:00.000Z");
const scheduler = createAdaptiveSamplingScheduler({ now: () => clock, normalIntervalMs: 1_000, neverBlindFloorMs: 30_000 });
const preprocessing = createPreprocessingEngine({ now: () => clock, motionThreshold: 0.025, maxQuietIntervalMs: 30_000 });
const perCamera = new Map(sources.map(source => [source.id, { kind: source.kind, name: source.name, samples: 0, ai_jobs: 0, candidates: 0, learning_samples: 0, priority_reasons: {} }]));
for (let round = 0; round < 3; round++) {
  const plan = scheduler.plan(successful.map(item => ({ camera_id: item.source.id, site_id: siteId, status: "ONLINE", channel_assignment: "ASSIGNED", physical_camera_attached: true,
    candidate_activity: item.motionScore >= 0.025, motion_score: item.motionScore, preprocessing_provenance: "LOCAL_FRAME_DIFF" })), { budget: 4, resourcePressure: "NORMAL" });
  for (const decision of plan.decisions.filter(item => item.request_sample)) {
    const row = perCamera.get(decision.camera_id); const input = successful.find(item => item.source.id === decision.camera_id);
    row.samples++; row.priority_reasons[decision.reason] = (row.priority_reasons[decision.reason] ?? 0) + 1;
    const work = preprocessing.evaluate({ camera: { camera_id: decision.camera_id, site_id: siteId, channel_assignment: "ASSIGNED", physical_camera_attached: true }, policy: "ADAPTIVE",
      health: { source: "ONLINE", frame_fresh: true }, motion_score: input.motionScore, observed_at: new Date(clock).toISOString() });
    row.ai_jobs += Number(work.request_ai); row.candidates += Number(Boolean(work.candidate));
  }
  clock += 1_000;
}
const learningScheduler = createAdaptiveSamplingScheduler({ now: () => clock, learningIntervalMs: 10_000 });
const learning = learningScheduler.plan(successful.map(item => ({ camera_id: item.source.id, site_id: siteId, status: "ONLINE", channel_assignment: "ASSIGNED", physical_camera_attached: true, learning_under_covered: true })),
  { purpose: "SITE_LEARNING", budget: successful.length });
for (const item of learning.decisions.filter(item => item.request_sample)) perCamera.get(item.camera_id).learning_samples++;
const empty = scheduler.plan(Array.from({ length: 6 }, (_, index) => ({ camera_id: `empty-${index + 1}`, site_id: siteId, channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false })), { budget: 6 });
const health = await Promise.all([fetch(`${dvrBase}/health`).then(response => response.json()), fetch(`${connectorBase}/health`).then(response => response.json())]);
const rows = [...perCamera.values()];
const fixedJobs = successful.length * 3;
const adaptiveJobs = rows.reduce((sum, row) => sum + row.ai_jobs, 0);
const adaptiveSamples = rows.reduce((sum, row) => sum + row.samples, 0);
const starved = rows.filter(row => row.samples === 0 || row.learning_samples === 0).map(row => row.name);
console.log(JSON.stringify({ status: successful.length === 11 && starved.length === 0 ? "PASS" : "PARTIAL", mode: "READ_ONLY_REAL_INPUT_REPLAY",
  duration_ms: Date.now() - startedAt, physical_cameras: 11, real_activity_inputs: successful.length,
  input_endpoint: { cheap_activity: successful.filter(item => item.endpoint === "activity").length,
    legacy_insights_fallback: successful.filter(item => item.endpoint === "legacy_insights_fallback").length,
    local_package_update_required_for_cheap_runtime_path: successful.some(item => item.endpoint === "legacy_insights_fallback") },
  fixed: { rounds: 3, cameras: successful.length, samples: fixedJobs, ai_jobs: fixedJobs },
  adaptive: { rounds: 3, cycle_budget: 4, samples: adaptiveSamples, ai_jobs: adaptiveJobs, candidates: rows.reduce((sum, row) => sum + row.candidates, 0),
    jobs_avoided: fixedJobs - adaptiveJobs, reduction: fixedJobs ? (fixedJobs - adaptiveJobs) / fixedJobs : null },
  learning_coverage: { expected: 11, sampled: rows.filter(row => row.learning_samples > 0).length, starved }, per_camera: rows,
  empty_slots: { count: 6, scheduled_work: empty.decisions.filter(item => item.request_sample).length, ai_work: 0, learning_work: 0 },
  quality: { precision: "NOT_MEASURABLE_IN_UNREVIEWED_WINDOW", recall: "NOT_MEASURABLE_NO_FN_GROUND_TRUTH", real_event_proof: "NOT_VERIFIED" },
  dvr: { expected: 10, progressing: health[0].mediaHeartbeat?.progressingRelays ?? null, stalled: health[0].mediaHeartbeat?.stalledRelays ?? null },
  tapo: { expected: 1, progressing: health[1].mediaHeartbeat?.progressingRelays ?? null, stalled: health[1].mediaHeartbeat?.stalledRelays ?? null },
  source_configuration_changed: false, raw_video_logged: false }, null, 2));
