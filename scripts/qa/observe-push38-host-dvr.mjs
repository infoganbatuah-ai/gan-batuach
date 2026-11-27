// Read-only, low-frequency correlation of Home Edge progression with host load.
// Writes only bounded non-secret aggregates to the restricted evidence folder.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, realpathSync } from "node:fs";
import { loadavg, cpus } from "node:os";
import { resolve, sep } from "node:path";

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const phase = arg("phase"), output = resolve(arg("output") || "");
const durationSec = Number(arg("duration-sec")), intervalSec = Number(arg("interval-sec"));
const gatewayPid = Number(arg("gateway-pid")), connectorPid = Number(arg("connector-pid"));
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
if (!/^[A-Z][A-Z0-9_]{1,30}$/.test(phase || "") || !output.startsWith(restricted) || existsSync(output) ||
  !Number.isInteger(durationSec) || durationSec < 30 || durationSec > 1900 ||
  !Number.isInteger(intervalSec) || intervalSec < 15 || intervalSec > 120 ||
  !Number.isInteger(gatewayPid) || gatewayPid < 2 || !Number.isInteger(connectorPid) || connectorPid < 2)
  throw new Error("P38_HOST_OBSERVATION_BOUNDED_INPUT_REQUIRED");

const run = (binary, args, timeout = 5_000) => {
  try { return execFileSync(binary, args, { encoding: "utf8", timeout, maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"] }); } catch { return null; }
};
const delay = ms => new Promise(done => setTimeout(done, ms));
const cpuTicks = () => cpus().reduce((a, core) => {
  for (const [key, value] of Object.entries(core.times)) a[key] = (a[key] || 0) + value;
  return a;
}, {});
const cpuPercent = (old, next) => {
  if (!old) return null;
  const total = Object.keys(next).reduce((sum, key) => sum + next[key] - old[key], 0);
  return total > 0 ? Math.round(1000 * (1 - (next.idle - old.idle) / total)) / 10 : null;
};
function processSnapshot() {
  const raw = run("/bin/ps", ["-Ao", "pid=,ppid=,state=,%cpu=,rss=,comm="], 8_000);
  if (!raw) return { available: false };
  const rows = raw.split("\n").map(line => line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(.+)$/))
    .filter(Boolean).map(row => ({ pid: Number(row[1]), parent: Number(row[2]), state: row[3],
      cpu: Number(row[4]), rss_kib: Number(row[5]), name: row[6].split("/").at(-1) }));
  const children = pid => rows.filter(row => row.parent === pid);
  const ffmpeg = rows.filter(row => row.name === "ffmpeg");
  const select = pid => { const row = rows.find(item => item.pid === pid);
    return row ? { pid, cpu: row.cpu, rss_kib: row.rss_kib, state: row.state } : null; };
  const category = name => /WeatherWidget/i.test(name) ? "WEATHER_WIDGET" :
    /ffmpeg/i.test(name) ? "FFMPEG" : /node/i.test(name) ? "NODE" :
    /WindowServer/i.test(name) ? "WINDOW_SERVER" : /Codex|ChatGPT|cua_node/i.test(name) ? "DEV_AGENT" :
      /VirtualMachine|qemu|colima|Docker/i.test(name) ? "VM" : /postgres/i.test(name) ? "POSTGRES" :
        /Chrome|Safari|Firefox/i.test(name) ? "BROWSER" : /Dropbox/i.test(name) ? "SYNC" : "OTHER";
  return { available: true, process_count: rows.length, runnable: rows.filter(row => row.state.startsWith("R")).length,
    zombie_count: rows.filter(row => row.state.startsWith("Z")).length,
    gateway: select(gatewayPid), connector: select(connectorPid),
    gateway_ffmpeg: children(gatewayPid).filter(row => row.name === "ffmpeg").map(row => row.pid).sort((a,b) => a-b),
    connector_ffmpeg: children(connectorPid).filter(row => row.name === "ffmpeg").map(row => row.pid).sort((a,b) => a-b),
    ffmpeg_total: ffmpeg.length, ffmpeg_zombies: ffmpeg.filter(row => row.state.startsWith("Z")).length,
    top: rows.sort((a, b) => b.cpu - a.cpu).slice(0, 8)
      .map(({ pid, cpu, rss_kib, name }) => ({ pid, cpu, rss_kib, category: category(name) })) };
}
async function health(port) {
  const start = Date.now();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return { http_status: response.status, duration_ms: Date.now() - start };
    const body = await response.json(), media = body.mediaHeartbeat || {}, discovery = body.lastDiscovery || {};
    const session = body.recorderSessionHeartbeat || {}, lifecycle = media.lifecycle || {};
    return { http_status: response.status, duration_ms: Date.now() - start, status: body.status || null,
      expected: discovery.assignedCount ?? discovery.channelCount ?? null, connected: discovery.connectedCount ?? null,
      empty: discovery.unassignedCount ?? null, progressing: media.progressingRelays ?? null,
      stalled: media.stalledRelays ?? null, active: media.activeRelays ?? null,
      inputs: (media.inputs || []).map(input => ({ channel: input.channel, bytes: input.bytes ?? null,
        chunks: input.chunks ?? null, age_ms: input.age_ms ?? null, input_idle_ms: input.input_idle_ms ?? null,
        stdin_backpressure: input.stdin_backpressure ?? null })),
      event_loop: body.eventLoop ? { delay_p99_ms: body.eventLoop.delay_p99_ms ?? null,
        delay_max_ms: body.eventLoop.delay_max_ms ?? null } : "NOT_IN_LEGACY_HEALTH",
      recorder_session_lifecycle: body.recorderSessionLifecycle ? {
        refreshes: body.recorderSessionLifecycle.refreshes ?? null,
        active_sessions: body.recorderSessionLifecycle.active_sessions ?? null
      } : "NOT_IN_LEGACY_HEALTH",
      lifecycle: Object.fromEntries(["starts", "upstreamEnded", "upstreamFailed", "staleInput",
        "stalePlaylist", "staleOnRequest", "inputSocketError", "inputAborted", "inputOtherError"]
        .map(key => [key, lifecycle[key] ?? null])),
      session: Object.fromEntries(["attempts", "responses_ok", "failures", "authentication_rejected"]
        .map(key => [key, session[key] ?? null])) };
  } catch (error) { return { http_status: null, duration_ms: Date.now() - start,
    reason: error?.name === "TimeoutError" ? "TIMEOUT" : "UNAVAILABLE" }; }
}

const start = Date.now(), interval = intervalSec * 1000, count = Math.ceil(durationSec / intervalSec);
let previousCpu = null, errors = 0, missed = 0;
for (let index = 0; index <= count; index++) {
  const scheduled = start + index * interval;
  await delay(Math.max(0, scheduled - Date.now()));
  const observed = Date.now(), ticks = cpuTicks();
  const [gateway, connector] = await Promise.all([health(18082), health(18083)]);
  const point = { protocol: "observer-push38-host-dvr-observation-v1", phase, sequence: index,
    scheduled_at: new Date(scheduled).toISOString(), observed_at: new Date(observed).toISOString(),
    drift_ms: observed - scheduled, host: { loadavg: loadavg(), cpu_count: cpus().length,
      busy_percent: cpuPercent(previousCpu, ticks), processes: processSnapshot() }, gateway, connector };
  previousCpu = ticks;
  if (point.drift_ms > interval) missed++;
  if (gateway.http_status !== 200 || gateway.progressing !== 10 || gateway.empty !== 6) errors++;
  appendFileSync(output, `${JSON.stringify(point)}\n`, { encoding: "utf8", flag: index === 0 ? "wx" : "a", mode: 0o600 });
  console.log(JSON.stringify({ phase, sequence: index, at: point.observed_at, load1: point.host.loadavg[0],
    host_busy: point.host.busy_percent, runnable: point.host.processes.runnable,
    ffmpeg: point.host.processes.ffmpeg_total, gateway: `${gateway.progressing ?? "?"}/10`,
    tapo: `${connector.progressing ?? "?"}/1`, gateway_stalled: gateway.stalled ?? null,
    gateway_health: gateway.http_status ?? gateway.reason ?? "FAIL", drift_ms: point.drift_ms }));
}
console.log(JSON.stringify({ phase, started_at: new Date(start).toISOString(), ended_at: new Date().toISOString(),
  duration_sec: Math.round((Date.now() - start) / 1000), checkpoints: count + 1,
  gateway_failed_checkpoints: errors, missed_checkpoints: missed,
  evidence_sha256: createHash("sha256").update((await import("node:fs")).readFileSync(output)).digest("hex") }));
