import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
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
const logPaths = { gateway: join(homedir(), "Library", "Logs", "com.ganbatuach.video-gateway.err.log"), connector: join(homedir(), "Library", "Logs", "com.ganbatuach.software-connector.tapo.err.log") };
const ffmpegCommand = [process.env.FFMPEG_PATH, "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"].find(value => value && existsSync(value));
if (!ffmpegCommand) throw new Error("ffmpeg_runtime_unavailable");

function atomicJson(path, value) { const temporary = `${path}.tmp`; writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); renameSync(temporary, path); }
function safeStat(path) { try { return statSync(path).size; } catch { return null; } }
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
async function processRow(pid) {
  try {
    const result = await exec("/bin/ps", ["-o", "pid=,etime=,%cpu=,rss=", "-p", String(pid)]);
    const [pidText, elapsed, cpu, rss] = result.stdout.trim().split(/\s+/);
    return { pid: Number(pidText), elapsed, cpu_percent: Number(cpu), rss_mb: Number((Number(rss) / 1024).toFixed(3)) };
  } catch { return { pid: null, elapsed: null, cpu_percent: null, rss_mb: null }; }
}
async function processInfo(pattern) {
  try {
    const { stdout } = await exec("/usr/bin/pgrep", ["-f", pattern]);
    const supervisorPid = Number(stdout.trim().split("\n").at(-1));
    const supervisor = await processRow(supervisorPid);
    let runtime = supervisor;
    try {
      const children = await exec("/usr/bin/pgrep", ["-P", String(supervisorPid)]);
      const runtimePid = Number(children.stdout.trim().split("\n").at(-1));
      if (runtimePid) runtime = await processRow(runtimePid);
    } catch {}
    return {
      ...supervisor,
      supervisor_pid: supervisor.pid,
      runtime_pid: runtime.pid,
      runtime_elapsed: runtime.elapsed,
      runtime_cpu_percent: runtime.cpu_percent,
      runtime_rss_mb: runtime.rss_mb,
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
async function deepProbe(sourceList) {
  let verified = 0; const failures = [];
  for (const source of sourceList) { try { const response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/playback`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(10_000) }); const body = await response.json(); const url = body.playback?.hls_url; if (!response.ok || !url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) || !await decodeFrame(url)) throw new Error("PLAYBACK_FRAME_UNAVAILABLE"); verified++; } catch { failures.push(source.tapo ? "tapo" : `dvr-${source.channel}`); } }
  const tapo = sourceList.find(source => source.tapo); const aiStarted = Date.now(); let ai = { ok: false, latency_ms: null };
  try { const response = await fetch(`http://127.0.0.1:18083/camera/${encodeURIComponent(tapo.id)}/detections`, { headers: { "x-video-gateway-secret": tapo.secret }, signal: AbortSignal.timeout(75_000) }); const body = await response.json(); ai = { ok: response.ok && body.insight?.object_detection?.status === "sampled", latency_ms: Date.now() - aiStarted, model: body.insight?.object_detection?.model_provenance?.model ?? null }; } catch { ai = { ok: false, latency_ms: Date.now() - aiStarted }; }
  const sampled = [];
  for (const source of sourceList) { try { let response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/activity`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(30_000) }); if (response.status === 404) response = await fetch(`http://127.0.0.1:${source.port}/camera/${encodeURIComponent(source.id)}/insights`, { headers: { "x-video-gateway-secret": source.secret }, signal: AbortSignal.timeout(45_000) }); const body = await response.json(); if (response.ok && body.local_processing === true && body.insight?.sampled_at) sampled.push(source.id); } catch {} }
  return { playback: { verified, failed: failures.length, failures }, ai, learning: { expected: 11, sampled: sampled.length, sampled_source_ids: sampled } };
}

const prior = existsSync(statePath) && args.get("resume") ? JSON.parse(readFileSync(statePath, "utf8")) : null;
const startedAt = prior?.started_at_ms || Date.now(); let sequence = prior?.checkpoint_count || 0, nextDeepProbeAt = prior?.next_deep_probe_at || startedAt, stopping = false;
process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });
const sourceList = await sources();
while (!stopping && Date.now() - startedAt < durationMs) {
  const sampledAt = Date.now(), [gateway, connector, gatewayResource, connectorResource] = await Promise.all([health(18082), health(18083), processInfo("run-persistent-home-gateway.mjs"), processInfo("run-software-connector.mjs")]);
  const point = { contract: "observer-reliability-checkpoint-v1", run_id: runId, sequence: ++sequence, sampled_at: new Date(sampledAt).toISOString(), elapsed_ms: sampledAt - startedAt,
    interval_ms: intervalMs,
    expected_physical_cameras: 11, empty_dvr_slots: 6,
    dvr: { health_ok: gateway.ok, expected: 10, progressing: gateway.body?.mediaHeartbeat?.progressingRelays ?? 0, stalled: gateway.body?.mediaHeartbeat?.stalledRelays ?? null, failed: gateway.body?.failedStreamCount ?? null, auth: gateway.body?.deviceAuthorization?.status ?? null, lifecycle: gateway.body?.mediaHeartbeat?.lifecycle ?? null, recorder_session: gateway.body?.recorderSessionHeartbeat ?? null },
    tapo: { health_ok: connector.ok, expected: 1, progressing: connector.body?.mediaHeartbeat?.progressingRelays ?? 0, stalled: connector.body?.mediaHeartbeat?.stalledRelays ?? null, failed: connector.body?.failedStreamCount ?? null, auth: connector.body?.deviceAuthorization?.status ?? null, lifecycle: connector.body?.mediaHeartbeat?.lifecycle ?? null },
    resources: { gateway: gatewayResource, connector: connectorResource },
    logs: {
      gateway_bytes: safeStat(logPaths.gateway), connector_bytes: safeStat(logPaths.connector),
      gateway_signals: logSignals(logPaths.gateway), connector_signals: logSignals(logPaths.connector)
    }, manual_interventions: 0 };
  if (sampledAt >= nextDeepProbeAt) { Object.assign(point, await deepProbe(sourceList)); nextDeepProbeAt = sampledAt + deepProbeMs; }
  appendFileSync(checkpointsPath, `${JSON.stringify(point)}\n`, { mode: 0o600 });
  atomicJson(statePath, { contract: "observer-reliability-soak-state-v1", run_id: runId, status: "RUNNING", started_at: new Date(startedAt).toISOString(), started_at_ms: startedAt, target_ended_at: new Date(startedAt + durationMs).toISOString(), duration_ms: durationMs, interval_ms: intervalMs, deep_probe_ms: deepProbeMs, checkpoint_count: sequence, last_checkpoint_at: point.sampled_at, next_deep_probe_at: nextDeepProbeAt, output_root: outputRoot });
  await sleep(Math.min(intervalMs, Math.max(0, startedAt + durationMs - Date.now())));
}
const checkpoints = readFileSync(checkpointsPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
const result = summarizeRealHomeSoak(checkpoints, { startedAt, endedAt: Date.now(), requiredDurationMs: REAL_SOAK_MINIMUM_MS }); assertQualificationResult(result);
atomicJson(resultPath, result); atomicJson(statePath, { ...JSON.parse(readFileSync(statePath, "utf8")), status: result.status, ended_at: result.ended_at, result_path: resultPath, gate_failures: result.gate_failures });
console.log(JSON.stringify(result));
