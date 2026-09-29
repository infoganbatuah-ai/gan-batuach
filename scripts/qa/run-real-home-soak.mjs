import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { QUALIFICATION_STAGE_MINIMUM_MS, assertQualificationStageResult,
  summarizeRealHomeSoak } from "../../lib/domain/digital-observer/reliability-qualification.mjs";
import { createQualificationMonitorLifecycle } from "../../lib/domain/digital-observer/qualification-monitor-lifecycle.mjs";
import { measureRealHomeAiRouting } from "./measure-real-home-ai-routing.mjs";
import { probeLocalHealth } from "./soak-health-probe.mjs";

const exec = promisify(execFile);
const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.replace(/^--/, "").split("="); return [key, rest.join("=") || true]; }));
const DVR_ASSIGNED_CHANNELS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 10, 11]);
const unavailableArgument = String(args.get("dvr-upstream-unavailable") ?? "2,8").trim();
const parsedUnavailable = unavailableArgument === "" ? [] : unavailableArgument.split(",").map(Number);
if (parsedUnavailable.some(value => !Number.isInteger(value)) ||
  new Set(parsedUnavailable).size !== parsedUnavailable.length ||
  parsedUnavailable.some(value => !DVR_ASSIGNED_CHANNELS.includes(value)))
  throw new Error("soak_dvr_upstream_unavailable_invalid");
const DVR_UPSTREAM_UNAVAILABLE = Object.freeze([...parsedUnavailable].sort((a, b) => a - b));
const DVR_AVAILABLE_CHANNELS = Object.freeze(DVR_ASSIGNED_CHANNELS.filter(channel =>
  !DVR_UPSTREAM_UNAVAILABLE.includes(channel)));
const DVR_SOURCE_AVAILABLE = DVR_AVAILABLE_CHANNELS.length;
const assertedAvailable = Number(args.get("dvr-source-available") ?? DVR_SOURCE_AVAILABLE);
if (!Number.isInteger(assertedAvailable) || assertedAvailable !== DVR_SOURCE_AVAILABLE)
  throw new Error("soak_dvr_source_availability_mismatch");
const stage = String(args.get("stage") || "V8").toUpperCase();
const requiredDurationMs = QUALIFICATION_STAGE_MINIMUM_MS[stage];
if (!requiredDurationMs) throw new Error("qualification_stage_invalid");
const durationMs = Number(args.get("duration-ms") || requiredDurationMs);
const intervalMs = Number(args.get("interval-ms") || 60_000);
const defaultDeepProbeMs = stage === "CANARY" ? 5 * 60_000 : stage === "PRE_SOAK" ? 29 * 60_000 : 60 * 60_000;
const deepProbeMs = Number(args.get("deep-probe-ms") || defaultDeepProbeMs);
if (!Number.isFinite(durationMs) || durationMs < requiredDurationMs || !Number.isFinite(intervalMs) || intervalMs < 10_000 ||
  !Number.isFinite(deepProbeMs) || deepProbeMs < intervalMs) throw new Error("soak_duration_or_interval_invalid");
const runId = String(args.get("run-id") || `push38-${new Date().toISOString().replace(/[:.]/g, "-")}`).replace(/[^a-zA-Z0-9._-]/g, "");
const outputRoot = resolve(String(args.get("output-dir") || join(process.cwd(), "qa-evidence", "push-38", runId)));
mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
const checkpointsPath = join(outputRoot, "checkpoints.ndjson"), statePath = join(outputRoot, "state.json"), resultPath = join(outputRoot, "result.json");
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
function classifyCheckpoint(probe, resource, expected) {
  if (probe.ok && (Number(probe.body?.mediaHeartbeat?.progressingRelays) < expected || probe.body?.status !== "healthy")) return "PRODUCT_FAILURE";
  if (resource?.inspection_ok === false && probe.ok) return "MONITOR_FAILURE";
  if (probe.ok && Number(probe.body?.mediaHeartbeat?.progressingRelays) === expected && probe.body?.status === "healthy") return "PASS";
  if (!probe.ok && probe.reason === "CONNECTION_REFUSED") return "PRODUCT_FAILURE";
  if (!probe.ok && resource?.inspection_ok === true && resource?.runtime_pid === null) return "PRODUCT_FAILURE";
  return "INSUFFICIENT_EVIDENCE";
}
function classifyGatewayCheckpoint(probe, resource) {
  const discovery = probe.body?.lastDiscovery || {}, progressing = Number(probe.body?.mediaHeartbeat?.progressingRelays ?? 0);
  const inputs = new Map((probe.body?.mediaHeartbeat?.inputs ?? [])
    .map(input => [Number(input.channel), input]));
  const requiredChannelsProgressing = DVR_AVAILABLE_CHANNELS.every(channel =>
    inputs.get(channel)?.progressing === true);
  const currentFailures = Number(discovery.failedAssignedCount ?? 0);
  const expectedStatus = currentFailures > 0 ? "degraded" : "healthy";
  const expectedHealthPayload = probe.http_status === 200 &&
    probe.body?.contract === "observer-edge-health-v1" && probe.body?.status === expectedStatus;
  if (resource?.inspection_ok === false && (probe.ok || expectedHealthPayload)) return "MONITOR_FAILURE";
  if ((!probe.ok && !expectedHealthPayload) || !resource?.runtime_pid) return "PRODUCT_FAILURE";
  // The owner-verified physical exception is a conservative denominator. A
  // previously unavailable source may recover during qualification, but that
  // extra stream must never substitute for a failed qualified channel.
  if (discovery.assignedCount !== 10 || discovery.unassignedCount !== 6 ||
    Number(discovery.connectedCount) < DVR_SOURCE_AVAILABLE ||
    Number(discovery.connectedCount) + currentFailures !== 10 ||
    currentFailures > DVR_UPSTREAM_UNAVAILABLE.length || progressing < DVR_SOURCE_AVAILABLE ||
    !requiredChannelsProgressing || probe.body?.status !== expectedStatus) return "PRODUCT_FAILURE";
  return "PASS";
}
async function processRow(pid) {
  try {
    const result = await exec("/bin/ps", ["-o", "pid=,ppid=,etime=,%cpu=,rss=,command=", "-p", String(pid)], { timeout: 2_000 });
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(.+)$/s.exec(result.stdout);
    if (!match) throw new Error("process_row_unavailable");
    const [, pidText, parentPid, elapsed, cpu, rss, command] = match;
    return { pid: Number(pidText), parent_pid: Number(parentPid), elapsed,
      cpu_percent: Number(cpu), rss_mb: Number((Number(rss) / 1024).toFixed(3)), command };
  } catch { return { pid: null, parent_pid: null, elapsed: null, cpu_percent: null, rss_mb: null }; }
}
async function processInfo(pattern) {
  try {
    const { stdout } = await exec("/usr/bin/pgrep", ["-f", pattern], { timeout: 2_000 });
    const candidates = (await Promise.all(stdout.trim().split("\n").filter(Boolean)
      .map(value => processRow(Number(value))))).filter(value => value.pid);
    // The managed runtime deliberately starts a tiny `caffeinate` child whose
    // arguments also contain the script name. Select the launchd-owned process
    // (or, defensively, the largest matching process) so resource telemetry is
    // recorded for Node rather than for the 0.3 MiB sleep-prevention helper.
    const supervisor = candidates.find(value => value.parent_pid === 1 &&
      !value.command?.startsWith("/usr/bin/caffeinate ")) ??
      candidates.sort((left, right) => (right.rss_mb ?? 0) - (left.rss_mb ?? 0))[0];
    let children = [];
    try {
      const { stdout: childIds } = await exec("/usr/bin/pgrep", ["-P", String(supervisor.pid)], { timeout: 2_000 });
      children = (await Promise.all(childIds.trim().split("\n").filter(Boolean)
        .map(value => processRow(Number(value))))).filter(value => value.pid);
    } catch {}
    // launchd owns the persistent supervisor; that supervisor owns both a tiny
    // caffeinate helper and the actual media HTTP child. Treating the parent as
    // the runtime hid a real child restart during the first PUSH 38 canary.
    const runtime = children.find(value => value.command?.includes("services/video-gateway/server.mjs")) ?? null;
    let openHandles = null;
    try { if (runtime?.pid) { const handles = await exec("/usr/sbin/lsof", ["-nP", "-p", String(runtime.pid)], { timeout: 3_000, maxBuffer: 4 * 1024 * 1024 }); openHandles = Math.max(0, handles.stdout.trim().split("\n").length - 1); } } catch {}
    return {
      ...supervisor,
      inspection_ok: true,
      supervisor_pid: supervisor.pid,
      runtime_pid: runtime?.pid ?? null,
      runtime_elapsed: runtime?.elapsed ?? null,
      runtime_cpu_percent: runtime?.cpu_percent ?? null,
      runtime_rss_mb: runtime?.rss_mb ?? null,
      open_handles: openHandles,
      total_cpu_percent: Number(((supervisor.cpu_percent ?? 0) + (runtime?.cpu_percent ?? 0)).toFixed(3)),
      total_rss_mb: Number(((supervisor.rss_mb ?? 0) + (runtime?.rss_mb ?? 0)).toFixed(3))
    };
  } catch { return { inspection_ok: false, pid: null, supervisor_pid: null, runtime_pid: null, elapsed: null, cpu_percent: null, rss_mb: null, runtime_rss_mb: null, total_rss_mb: null }; }
}
async function keychain(account) { const { stdout } = await exec("/usr/bin/security", ["find-generic-password", "-s", gatewayService, "-a", account, "-w"]); return stdout.trim(); }
function connectorSecret(name) { return readFileSync(join(connectorSecrets, name), "utf8").trim(); }
async function sources() {
  const profile = JSON.parse(await keychain("dvr_profile_json")); const host = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`).hostname;
  const namespace = String(profile.metadata?.stream_namespace || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
  const gatewaySecret = await keychain("gateway_signing_secret");
  const gatewayAiIdentity = { gatewaySecret, deviceId: await keychain("device_gateway_id"),
    siteId: await keychain("device_observer_site_id"), profile };
  const dvr = DVR_ASSIGNED_CHANNELS.map(channel => ({ id: `dvr_${createHash("sha256").update([profile.connection_type || "dvr", host, channel, namespace].join(":")).digest("hex").slice(0,18)}_${channel}`,
    channel, port: 18082, secret: gatewaySecret, source_available: DVR_AVAILABLE_CHANNELS.includes(channel),
    upstream_unavailable: DVR_UPSTREAM_UNAVAILABLE.includes(channel) }));
  // The cloud-mapped camera Source ID and the local relay stream ID are
  // intentionally different identities. During bounded HOME_QA ingress the
  // Product mapping route is not exposed, so playback must address the local
  // relay by the same deterministic namespace contract used by the runtime.
  // Keep the canonical Source ID only as continuity metadata.
  const connectorProfile = JSON.parse(connectorSecret("dvr_profile_json"));
  const connectorHost = new URL(connectorProfile.endpoint.includes("://")
    ? connectorProfile.endpoint : `rtsp://${connectorProfile.endpoint}`).hostname;
  const connectorNamespace = connectorSecret("connector_stream_namespace")
    .trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
  const connectorLocalStreamId = `dvr_${createHash("sha256").update([
    connectorProfile.connection_type || "dvr", connectorHost, 1, connectorNamespace
  ].join(":")).digest("hex").slice(0,18)}_1`;
  return { sourceList: [...dvr, { id: connectorLocalStreamId,
    camera_source_id: connectorSecret("connector_camera_source_id"), channel: 1, port: 18083,
    secret: connectorSecret("gateway_signing_secret"), tapo: true }], gatewayAiIdentity };
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
async function deepProbe(sourceList, gatewayAiIdentity) {
  sourceList = sourceList.filter(source => source.tapo || source.source_available !== false);
  let verified = 0; const failures = [], successes = [];
  for (const source of sourceList) { const name = source.tapo ? "tapo" : `dvr-${source.channel}`; try { const response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/playback`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(10_000) }); const body = await response.json(); const url = body.playback?.hls_url; if (!response.ok || !url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) || !await decodeFrame(url)) throw new Error("PLAYBACK_FRAME_UNAVAILABLE"); verified++; successes.push(name); } catch { failures.push(name); } }
  const policy = await aiPolicy(sourceList);
  const aiStarted = Date.now();
  let ai;
  if (policy.failures.length) {
    // The bounded HOME_QA ingress intentionally exposes OTA authorization
    // only. Prove the real camera -> scheduler -> durable queue -> worker ->
    // inference path with the dedicated read-only local qualification instead
    // of weakening ingress to expose the Product event-manifest route.
    try {
      const proof = await measureRealHomeAiRouting(gatewayAiIdentity);
      const passed = proof.status === "PASS" && proof.mode === "READ_ONLY_REAL_CAMERA_ROUTING" &&
        proof.result?.job_id && proof.result?.model && proof.result?.runtime;
      ai = { ok: Boolean(passed), expected: 1, verified: passed ? 1 : 0, failed: passed ? 0 : 1,
        failures: passed ? [] : ["real-camera-routing"], policy_excluded: [], manifest_failures: policy.failures,
        qualification_path: proof.path ?? null, event_fabricated: proof.event_fabricated === true,
        latency_ms: Date.now() - aiStarted, per_source_latency_ms: [proof.result?.total_ms].filter(Number.isFinite),
        models: proof.result?.model ? [proof.result.model] : [] };
    } catch (error) {
      ai = { ok: false, expected: 1, verified: 0, failed: 1, failures: ["real-camera-routing"],
        policy_excluded: [], manifest_failures: policy.failures, latency_ms: Date.now() - aiStarted,
        per_source_latency_ms: [], models: [],
        qualification_error: String(error?.code || error?.name || "AI_ROUTING_FAILED") };
    }
  } else {
    const aiSources = sourceList.filter(source => policy.eligible.has(source.id));
    const aiLatencies = [], aiFailures = [], models = new Set();
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
    ai = { ok: aiSources.length > 0 && aiFailures.length === 0, expected: aiSources.length,
      verified: aiSources.length - aiFailures.length, failed: aiFailures.length, failures: aiFailures,
      policy_excluded: policy.excluded.map(value => sourceList.find(source => source.id === value.stream_id)?.tapo
        ? { source: "tapo", reason: value.reason }
        : { source: `dvr-${sourceList.find(source => source.id === value.stream_id)?.channel ?? "unknown"}`, reason: value.reason }),
      manifest_failures: [], latency_ms: Date.now() - aiStarted, per_source_latency_ms: aiLatencies,
      models: [...models].sort() };
  }
  const sampled = [];
  for (const source of sourceList) { try { let response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/activity`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(30_000) }); if (response.status === 404) response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/insights`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(45_000) }); const body = await response.json(); if (response.ok && body.local_processing === true && body.insight?.sampled_at) sampled.push(source.id); } catch {} }
  return { playback: { verified, failed: failures.length, successes, failures }, ai,
    learning: { expected: 9, sampled: sampled.length, sampled_source_ids: sampled } };
}

const prior = existsSync(statePath) && args.get("resume") ? JSON.parse(readFileSync(statePath, "utf8")) : null;
const startedAt = prior?.started_at_ms || Date.now(); let sequence = prior?.checkpoint_count || 0, nextDeepProbeAt = prior?.next_deep_probe_at || startedAt;
let deepProbeInFlight = false, completedDeepProbe = null;
if (!existsSync(checkpointsPath)) writeFileSync(checkpointsPath, "", { mode: 0o600 });
const lifecycle = createQualificationMonitorLifecycle({
  onStop: termination => atomicJson(statePath, {
    ...(existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {}),
    contract: "observer-reliability-soak-state-v1",
    run_id: runId,
    status: "STOP_REQUESTED",
    termination
  })
});
process.once("SIGTERM", () => lifecycle.requestStop("SIGTERM"));
process.once("SIGINT", () => lifecycle.requestStop("SIGINT"));
atomicJson(statePath, { contract: "observer-reliability-soak-state-v1", run_id: runId, status: "RUNNING",
  started_at: new Date(startedAt).toISOString(), started_at_ms: startedAt,
  target_ended_at: new Date(startedAt + durationMs).toISOString(), duration_ms: durationMs,
  interval_ms: intervalMs, deep_probe_ms: deepProbeMs, checkpoint_count: sequence,
  last_checkpoint_at: prior?.last_checkpoint_at ?? null, next_deep_probe_at: nextDeepProbeAt,
  output_root: outputRoot,
  monitor_process: { pid: process.pid, parent_pid: process.ppid, started_at: new Date().toISOString() } });
const { sourceList, gatewayAiIdentity } = await sources();
while (!lifecycle.stopped() && Date.now() - startedAt < durationMs) {
  // Cadence is anchored to the run start, not to the completion of the prior
  // sample. A slow deep probe must never consume the next minute's checkpoint.
  await lifecycle.wait(Math.max(0, startedAt + sequence * intervalMs - Date.now()));
  if (lifecycle.stopped() || Date.now() - startedAt >= durationMs) break;
  const scheduledAt = startedAt + sequence * intervalMs;
  const sampledAt = Date.now();
  const [gateway, connector, gatewayResource, connectorResource] = await Promise.all([probeLocalHealth(18082), probeLocalHealth(18083), processInfo("run-persistent-home-gateway.mjs"), processInfo("run-software-connector.mjs")]);
  const probeCompletedAt = Date.now();
  const point = { contract: "observer-reliability-checkpoint-v1", qualification_stage: stage,
    run_id: runId, sequence: ++sequence, sampled_at: new Date(sampledAt).toISOString(), elapsed_ms: sampledAt - startedAt,
    scheduled_at: new Date(scheduledAt).toISOString(), drift_ms: sampledAt - scheduledAt, probe_duration_ms: probeCompletedAt - sampledAt, interval_ms: intervalMs,
    expected_physical_cameras: 11, source_available_physical_cameras: DVR_SOURCE_AVAILABLE + 1, empty_dvr_slots: 6,
    dvr: { health_ok: gateway.ok, health_error: gateway.reason, health_http_status: gateway.http_status, liveness: gateway.liveness ?? null, event_loop: gateway.body?.eventLoop ?? null, component_status: gateway.body?.status ?? null, classification: classifyGatewayCheckpoint(gateway, gatewayResource), health_latency_ms: gateway.latency_ms, expected: 10, source_available: DVR_SOURCE_AVAILABLE, known_upstream_unavailable: DVR_UPSTREAM_UNAVAILABLE, progressing: gateway.body?.mediaHeartbeat?.progressingRelays ?? 0, stalled: gateway.body?.mediaHeartbeat?.stalledRelays ?? null, failed: gateway.body?.failedStreamCount ?? null, auth: gateway.body?.deviceAuthorization?.status ?? null, lifecycle: gateway.body?.mediaHeartbeat?.lifecycle ?? null, recorder_session: gateway.body?.recorderSessionHeartbeat ?? null,
      session_lifecycle: gateway.body?.recorderSessionLifecycle ?? null, relay_diagnostics: gateway.body?.mediaHeartbeat?.source_diagnostics ?? null,
      inputs: (gateway.body?.mediaHeartbeat?.inputs ?? []).map(value => Object.fromEntries(["channel", "progressing", "input_codec", "encoder", "format", "bytes", "chunks", "age_ms", "input_idle_ms", "stdin_backpressure", "stdin_queued_bytes"].map(key => [key, value[key] ?? null]))) },
    tapo: { health_ok: connector.ok, health_error: connector.reason, health_http_status: connector.http_status, liveness: connector.liveness ?? null, event_loop: connector.body?.eventLoop ?? null, component_status: connector.body?.status ?? null, classification: classifyCheckpoint(connector, connectorResource, 1), health_latency_ms: connector.latency_ms, expected: 1, progressing: connector.body?.mediaHeartbeat?.progressingRelays ?? 0, stalled: connector.body?.mediaHeartbeat?.stalledRelays ?? null, failed: connector.body?.failedStreamCount ?? null, auth: connector.body?.deviceAuthorization?.status ?? null, lifecycle: connector.body?.mediaHeartbeat?.lifecycle ?? null,
      relay_diagnostics: connector.body?.mediaHeartbeat?.source_diagnostics ?? null,
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
    void deepProbe(sourceList, gatewayAiIdentity).then(result => { completedDeepProbe = result; }).catch(error => {
      completedDeepProbe = { deep_probe_error: String(error?.code || error?.name || "DEEP_PROBE_FAILED") };
    }).finally(() => { deepProbeInFlight = false; });
  }
  appendFileSync(checkpointsPath, `${JSON.stringify(point)}\n`, { mode: 0o600 });
  atomicJson(statePath, { contract: "observer-reliability-soak-state-v1", run_id: runId, status: "RUNNING", started_at: new Date(startedAt).toISOString(), started_at_ms: startedAt, target_ended_at: new Date(startedAt + durationMs).toISOString(), duration_ms: durationMs, interval_ms: intervalMs, deep_probe_ms: deepProbeMs, checkpoint_count: sequence, last_checkpoint_at: point.sampled_at, next_deep_probe_at: nextDeepProbeAt, output_root: outputRoot });
}
const checkpoints = readFileSync(checkpointsPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
const result = summarizeRealHomeSoak(checkpoints, { startedAt, endedAt: Date.now(),
  requiredDurationMs, dvrSourceAvailable: DVR_SOURCE_AVAILABLE,
  dvrKnownUpstreamUnavailable: DVR_UPSTREAM_UNAVAILABLE });
const stagedResult = { ...result, qualification_stage: stage };
const termination = lifecycle.termination();
const durableResult = termination ? { ...stagedResult, termination } : stagedResult;
atomicJson(resultPath, durableResult); atomicJson(statePath, { ...JSON.parse(readFileSync(statePath, "utf8")), status: durableResult.status, ended_at: durableResult.ended_at, result_path: resultPath, gate_failures: durableResult.gate_failures, ...(termination ? { termination } : {}) });
assertQualificationStageResult(durableResult, stage);
console.log(JSON.stringify(durableResult));
