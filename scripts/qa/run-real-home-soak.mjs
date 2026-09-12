import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { REAL_SOAK_MINIMUM_MS, assertQualificationResult, summarizeRealHomeSoak } from "../../lib/domain/digital-observer/reliability-qualification.mjs";

const exec = promisify(execFile);
const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.replace(/^--/, "").split("="); return [key, rest.join("=") || true]; }));
const durationMs = Number(args.get("duration-ms") || REAL_SOAK_MINIMUM_MS);
const intervalMs = Number(args.get("interval-ms") || 60_000);
const deepProbeMs = Number(args.get("deep-probe-ms") || 60 * 60_000);
if (!Number.isFinite(durationMs) || durationMs < 60_000 || !Number.isFinite(intervalMs) || intervalMs < 10_000) throw new Error("soak_duration_or_interval_invalid");
const runId = String(args.get("run-id") || `push38-${new Date().toISOString().replace(/[:.]/g, "-")}`).replace(/[^a-zA-Z0-9._-]/g, "");
const outputRoot = resolve(String(args.get("output-dir") || join(process.cwd(), "qa-evidence", "push-38", runId)));
mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
const checkpointsPath = join(outputRoot, "checkpoints.ndjson"), statePath = join(outputRoot, "state.json"), resultPath = join(outputRoot, "result.json");
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const gatewayService = "com.ganbatuach.video-gateway.runtime";
const connectorSecrets = process.env.OBSERVER_CONNECTOR_SECRET_DIR || join(homedir(), "Library", "Application Support", "Digital Observer", "Tapo Connector", "secrets");
const dataRoots = {
  gateway: process.env.OBSERVER_GATEWAY_DATA_DIR || join(homedir(), ".local", "share", "gan-batuach", "video-gateway"),
  connector: process.env.OBSERVER_CONNECTOR_DATA_DIR || join(homedir(), "Library", "Application Support", "Digital Observer", "Tapo Connector")
};
const logPaths = { gateway: join(homedir(), "Library", "Logs", "com.ganbatuach.video-gateway.err.log"), connector: join(homedir(), "Library", "Logs", "com.ganbatuach.software-connector.tapo.err.log") };
const ffmpegCommand = [process.env.FFMPEG_PATH, "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"].find(value => value && existsSync(value));
if (!ffmpegCommand) throw new Error("ffmpeg_runtime_unavailable");

function atomicJson(path, value) { const temporary = `${path}.tmp`; writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); renameSync(temporary, path); }
function safeStat(path) { try { return statSync(path).size; } catch { return null; } }
function runtimeState(root) {
  try {
    const value = JSON.parse(readFileSync(join(root, "journal-status.json"), "utf8"));
    const offline = value.offline_buffer && typeof value.offline_buffer === "object" ? value.offline_buffer : null;
    const disk = statfsSync(root);
    return {
      journal_status: value.status ?? null,
      coverage: value.coverage ? Object.fromEntries(["status", "configured", "enabled", "attempted", "sampled", "unavailable"].map(key => [key, value.coverage[key] ?? null])) : null,
      offline_buffer: offline ? Object.fromEntries(["contract", "state", "queue_depth", "queue_bytes", "oldest_item_age_ms", "retry_count", "failed_items", "disk_pressure"].map(key => [key, offline[key] ?? null])) : {
        contract: "observer-offline-buffer-compatibility-v1", state: value.cloud_sync_state ?? "LEGACY_STATUS", queue_depth: Number(value.pending ?? 0), queue_bytes: null,
        oldest_item_age_ms: null, retry_count: Number(value.delivery_failures ?? 0), failed_items: Number(value.delivery_failures ?? 0), disk_pressure: "UNKNOWN"
      },
      ai_queue: value.ai_queue ? Object.fromEntries(["contract", "backend", "queue_depth", "oldest_job_age_ms", "jobs_per_second", "retry_count", "dead_letter_count"].map(key => [key, value.ai_queue[key] ?? null])) : null,
      delivery_in_progress: value.delivery_in_progress === true,
      queue_files_bytes: ["journal-outbox.sqlite", "journal-outbox.sqlite-wal", "journal-outbox.sqlite-shm"].reduce((sum, name) => sum + (safeStat(join(root, name)) ?? 0), 0),
      disk_free_bytes: Number(disk.bavail) * Number(disk.bsize)
    };
  } catch { return { journal_status: "UNAVAILABLE", coverage: null, offline_buffer: null, ai_queue: null, delivery_in_progress: false, queue_files_bytes: null, disk_free_bytes: null }; }
}
function logSignals(path) {
  try {
    const lines = readFileSync(path, "utf8").split("\n");
    return {
      cloud_401: lines.filter(line => /(?:\bHTTP\/?[0-9.]*\s+|\bstatus(?:Code)?[=: ]+|\bresponse[=: ]+)401\b/i.test(line)).length,
      set_type_of_service_einval: lines.filter(line => /setTypeOfService/i.test(line) && /\bEINVAL\b/.test(line)).length,
      fatal_or_uncaught: lines.filter(line => /\b(?:uncaught|fatal)\b/i.test(line)).length
    };
  } catch { return { cloud_401: null, set_type_of_service_einval: null, fatal_or_uncaught: null }; }
}
async function health(port) { const started = Date.now(); try { const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(8_000) }); const body = await response.json(); return { ok: response.ok && body.ok === true, latency_ms: Date.now() - started, body }; } catch (error) { return { ok: false, latency_ms: Date.now() - started, error: error?.cause?.code || error?.name || "REQUEST_FAILED" }; } }
function classifyCheckpoint(probe, resource, expected) {
  if (probe.ok && Number(probe.body?.mediaHeartbeat?.progressingRelays) === expected && probe.body?.status === "healthy") return "PASS";
  if (probe.ok && (Number(probe.body?.mediaHeartbeat?.progressingRelays) < expected || probe.body?.status !== "healthy")) return "PRODUCT_FAILURE";
  if (!probe.ok && resource?.runtime_pid === null) return "PRODUCT_FAILURE";
  return "INSUFFICIENT_EVIDENCE";
}
async function processRow(pid) {
  try {
    const result = await exec("/bin/ps", ["-o", "pid=,etime=,%cpu=,rss=", "-p", String(pid)], { timeout: 2_000 });
    const [pidText, elapsed, cpu, rss] = result.stdout.trim().split(/\s+/);
    return { pid: Number(pidText), elapsed, cpu_percent: Number(cpu), rss_mb: Number((Number(rss) / 1024).toFixed(3)) };
  } catch { return { pid: null, elapsed: null, cpu_percent: null, rss_mb: null }; }
}
async function processInfo(pattern) {
  try {
    const { stdout } = await exec("/usr/bin/pgrep", ["-f", pattern], { timeout: 2_000 });
    const supervisorPid = Number(stdout.trim().split("\n").at(-1));
    const supervisor = await processRow(supervisorPid);
    let runtime = supervisor;
    try {
      const children = await exec("/usr/bin/pgrep", ["-P", String(supervisorPid)], { timeout: 2_000 });
      const runtimePid = Number(children.stdout.trim().split("\n").at(-1));
      if (runtimePid) runtime = await processRow(runtimePid);
    } catch {}
    let openHandles = null;
    try { const handles = await exec("/usr/sbin/lsof", ["-nP", "-p", String(runtime.pid)], { timeout: 3_000, maxBuffer: 4 * 1024 * 1024 }); openHandles = Math.max(0, handles.stdout.trim().split("\n").length - 1); } catch {}
    return {
      ...supervisor,
      supervisor_pid: supervisor.pid,
      runtime_pid: runtime.pid,
      runtime_elapsed: runtime.elapsed,
      runtime_cpu_percent: runtime.cpu_percent,
      runtime_rss_mb: runtime.rss_mb,
      open_handles: openHandles,
      total_cpu_percent: Number(((supervisor.cpu_percent ?? 0) + (runtime.pid === supervisor.pid ? 0 : runtime.cpu_percent ?? 0)).toFixed(3)),
      total_rss_mb: Number(((supervisor.rss_mb ?? 0) + (runtime.pid === supervisor.pid ? 0 : runtime.rss_mb ?? 0)).toFixed(3))
    };
  } catch { return { pid: null, supervisor_pid: null, runtime_pid: null, elapsed: null, cpu_percent: null, rss_mb: null, runtime_rss_mb: null, total_rss_mb: null }; }
}
async function keychain(account) { const { stdout } = await exec("/usr/bin/security", ["find-generic-password", "-s", gatewayService, "-a", account, "-w"]); return stdout.trim(); }
function connectorSecret(name) { return readFileSync(join(connectorSecrets, name), "utf8").trim(); }
async function sources() {
  const profile = JSON.parse(await keychain("dvr_profile_json")); const host = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`).hostname;
  const namespace = String(profile.metadata?.stream_namespace || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
  const gatewaySecret = await keychain("gateway_signing_secret");
  const dvr = [1,2,3,4,5,6,7,8,10,11].map(channel => ({ id: `dvr_${createHash("sha256").update([profile.connection_type || "dvr", host, channel, namespace].join(":")).digest("hex").slice(0,18)}_${channel}`, channel, port: 18082, secret: gatewaySecret }));
  return [...dvr, { id: connectorSecret("connector_gateway_stream_id"), channel: 1, port: 18083, secret: connectorSecret("gateway_signing_secret"), tapo: true }];
}
async function decodeFrame(url) { try { await exec(ffmpegCommand, ["-hide_banner", "-loglevel", "error", "-i", url, "-frames:v", "1", "-f", "null", "-"], { timeout: 20_000, maxBuffer: 1024 * 1024 }); return true; } catch { return false; } }
async function aiPolicy(sourceList) {
  const visualTypes = new Set(["person_detected", "person_entered", "person_exited", "vehicle_entered", "vehicle_exited", "person_near_pool_off_hours", "unauthorized_night_motion"]);
  const eligible = new Set(), excluded = [], failures = [];
  for (const port of [...new Set(sourceList.map(source => source.port))]) {
    const reference = sourceList.find(source => source.port === port);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/cloud/event-manifest`, { headers: { "x-video-gateway-secret": reference.secret }, signal: AbortSignal.timeout(30_000) });
      const body = await response.json(), manifest = body.data ?? body;
      if (!response.ok || !Array.isArray(manifest.cameras)) throw new Error("MANIFEST_UNAVAILABLE");
      for (const camera of manifest.cameras) {
        if (camera.monitoring_enabled === true && camera.object_analysis_enabled !== false && Array.isArray(camera.supported_event_types) && camera.supported_event_types.some(type => visualTypes.has(type))) eligible.add(camera.stream_id);
        else if (camera.monitoring_enabled === true && sourceList.some(source => source.id === camera.stream_id)) excluded.push({ stream_id: camera.stream_id, reason: camera.zone_type === "PARKING" ? "crossing_line_not_configured" : "no_supported_visual_event_rule" });
      }
    } catch { failures.push(port); }
  }
  return { eligible, excluded, failures };
}
async function deepProbe(sourceList) {
  let verified = 0; const failures = [], successes = [];
  for (const source of sourceList) { const name = source.tapo ? "tapo" : `dvr-${source.channel}`; try { const response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/playback`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(10_000) }); const body = await response.json(); const url = body.playback?.hls_url; if (!response.ok || !url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) || !await decodeFrame(url)) throw new Error("PLAYBACK_FRAME_UNAVAILABLE"); verified++; successes.push(name); } catch { failures.push(name); } }
  const policy = await aiPolicy(sourceList);
  const aiSources = sourceList.filter(source => policy.eligible.has(source.id));
  const aiStarted = Date.now(), aiLatencies = [], aiFailures = [], models = new Set();
  for (const source of aiSources) {
    const started = Date.now();
    try {
      const response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/detections`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(75_000) });
      const body = await response.json();
      if (!response.ok || body.insight?.object_detection?.status !== "sampled") throw new Error("AI_SAMPLE_UNAVAILABLE");
      aiLatencies.push(Date.now() - started);
      if (body.insight?.object_detection?.model_provenance?.model) models.add(body.insight.object_detection.model_provenance.model);
    } catch { aiFailures.push(source.tapo ? "tapo" : `dvr-${source.channel}`); }
  }
  const ai = { ok: policy.failures.length === 0 && aiSources.length > 0 && aiFailures.length === 0, expected: aiSources.length, verified: aiSources.length - aiFailures.length,
    failed: aiFailures.length, failures: aiFailures, policy_excluded: policy.excluded.map(value => sourceList.find(source => source.id === value.stream_id)?.tapo ? { source: "tapo", reason: value.reason } : { source: `dvr-${sourceList.find(source => source.id === value.stream_id)?.channel ?? "unknown"}`, reason: value.reason }),
    manifest_failures: policy.failures, latency_ms: Date.now() - aiStarted, per_source_latency_ms: aiLatencies, models: [...models].sort() };
  const sampled = [];
  for (const source of sourceList) { try { let response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/activity`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(30_000) }); if (response.status === 404) response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/insights`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(45_000) }); const body = await response.json(); if (response.ok && body.local_processing === true && body.insight?.sampled_at) sampled.push(source.id); } catch {} }
  return { playback: { verified, failed: failures.length, successes, failures }, ai, learning: { expected: 11, sampled: sampled.length, sampled_source_ids: sampled } };
}

const prior = existsSync(statePath) && args.get("resume") ? JSON.parse(readFileSync(statePath, "utf8")) : null;
const startedAt = prior?.started_at_ms || Date.now(); let sequence = prior?.checkpoint_count || 0, nextDeepProbeAt = prior?.next_deep_probe_at || startedAt, stopping = false;
let deepProbeInFlight = false, completedDeepProbe = null;
process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });
const sourceList = await sources();
while (!stopping && Date.now() - startedAt < durationMs) {
  // Cadence is anchored to the run start, not to the completion of the prior
  // sample. A slow deep probe must never consume the next minute's checkpoint.
  await sleep(Math.max(0, startedAt + sequence * intervalMs - Date.now()));
  if (stopping || Date.now() - startedAt >= durationMs) break;
  const sampledAt = Date.now(), [gateway, connector, gatewayResource, connectorResource] = await Promise.all([health(18082), health(18083), processInfo("run-persistent-home-gateway.mjs"), processInfo("run-software-connector.mjs")]);
  const point = { contract: "observer-reliability-checkpoint-v1", run_id: runId, sequence: ++sequence, sampled_at: new Date(sampledAt).toISOString(), elapsed_ms: sampledAt - startedAt,
    interval_ms: intervalMs,
    expected_physical_cameras: 11, empty_dvr_slots: 6,
    dvr: { health_ok: gateway.ok, health_error: gateway.error ?? null, component_status: gateway.body?.status ?? null, classification: classifyCheckpoint(gateway, gatewayResource, 10), health_latency_ms: gateway.latency_ms, expected: 10, progressing: gateway.body?.mediaHeartbeat?.progressingRelays ?? 0, stalled: gateway.body?.mediaHeartbeat?.stalledRelays ?? null, failed: gateway.body?.failedStreamCount ?? null, auth: gateway.body?.deviceAuthorization?.status ?? null, lifecycle: gateway.body?.mediaHeartbeat?.lifecycle ?? null, recorder_session: gateway.body?.recorderSessionHeartbeat ?? null,
      inputs: (gateway.body?.mediaHeartbeat?.inputs ?? []).map(value => Object.fromEntries(["channel", "progressing", "input_codec", "encoder", "format", "bytes", "chunks", "age_ms", "input_idle_ms", "stdin_backpressure", "stdin_queued_bytes"].map(key => [key, value[key] ?? null]))) },
    tapo: { health_ok: connector.ok, health_error: connector.error ?? null, component_status: connector.body?.status ?? null, classification: classifyCheckpoint(connector, connectorResource, 1), health_latency_ms: connector.latency_ms, expected: 1, progressing: connector.body?.mediaHeartbeat?.progressingRelays ?? 0, stalled: connector.body?.mediaHeartbeat?.stalledRelays ?? null, failed: connector.body?.failedStreamCount ?? null, auth: connector.body?.deviceAuthorization?.status ?? null, lifecycle: connector.body?.mediaHeartbeat?.lifecycle ?? null,
      inputs: (connector.body?.mediaHeartbeat?.inputs ?? []).map(value => Object.fromEntries(["channel", "progressing", "input_codec", "encoder", "format", "bytes", "chunks", "age_ms", "input_idle_ms", "stdin_backpressure", "stdin_queued_bytes"].map(key => [key, value[key] ?? null]))) },
    release: { gateway: gateway.body?.edgeRuntime ?? null, connector: connector.body?.edgeRuntime ?? null },
    resources: { gateway: gatewayResource, connector: connectorResource },
    runtime_state: { gateway: runtimeState(dataRoots.gateway), connector: runtimeState(dataRoots.connector) },
    logs: {
      gateway_bytes: safeStat(logPaths.gateway), connector_bytes: safeStat(logPaths.connector),
      gateway_signals: logSignals(logPaths.gateway), connector_signals: logSignals(logPaths.connector)
    }, manual_interventions: 0 };
  if (completedDeepProbe) { Object.assign(point, completedDeepProbe); completedDeepProbe = null; }
  if (sampledAt >= nextDeepProbeAt && !deepProbeInFlight) {
    deepProbeInFlight = true;
    nextDeepProbeAt = sampledAt + deepProbeMs;
    void deepProbe(sourceList).then(result => { completedDeepProbe = result; }).catch(error => {
      completedDeepProbe = { deep_probe_error: String(error?.code || error?.name || "DEEP_PROBE_FAILED") };
    }).finally(() => { deepProbeInFlight = false; });
  }
  appendFileSync(checkpointsPath, `${JSON.stringify(point)}\n`, { mode: 0o600 });
  atomicJson(statePath, { contract: "observer-reliability-soak-state-v1", run_id: runId, status: "RUNNING", started_at: new Date(startedAt).toISOString(), started_at_ms: startedAt, target_ended_at: new Date(startedAt + durationMs).toISOString(), duration_ms: durationMs, interval_ms: intervalMs, deep_probe_ms: deepProbeMs, checkpoint_count: sequence, last_checkpoint_at: point.sampled_at, next_deep_probe_at: nextDeepProbeAt, output_root: outputRoot });
}
const checkpoints = readFileSync(checkpointsPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
const result = summarizeRealHomeSoak(checkpoints, { startedAt, endedAt: Date.now(), requiredDurationMs: REAL_SOAK_MINIMUM_MS }); assertQualificationResult(result);
atomicJson(resultPath, result); atomicJson(statePath, { ...JSON.parse(readFileSync(statePath, "utf8")), status: result.status, ended_at: result.ended_at, result_path: resultPath, gate_failures: result.gate_failures });
console.log(JSON.stringify(result));
