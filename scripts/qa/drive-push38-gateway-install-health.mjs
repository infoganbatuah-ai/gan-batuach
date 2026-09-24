// During the bounded Gateway installation health gate, exercise only the
// authorized loopback playback contract for the eight DVR channels already
// proven source-available. This creates real relay demand without changing
// configuration, identity, sources, or OTA state.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const CHANNELS = Object.freeze([1, 3, 4, 5, 6, 7, 10, 11]);
const RELEASE_ID = "qa-p38-health-gateway-finite-handoff-76781a8e0832";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const timeoutMs = Number(option("timeout-ms") || 180_000);
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted) || existsSync(output) || !Number.isFinite(timeoutMs) ||
  timeoutMs < 90_000 || timeoutMs > 5 * 60_000)
  throw new Error("P38_GATEWAY_HEALTH_DRIVER_SCOPE_INVALID");

const store = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const profile = JSON.parse(store.read("dvr_profile_json"));
const secret = store.read("gateway_signing_secret");
if (!profile?.endpoint || !secret) throw new Error("P38_GATEWAY_HEALTH_DRIVER_CONFIG_UNAVAILABLE");
const endpoint = new URL(String(profile.endpoint).includes("://") ? profile.endpoint : `http://${profile.endpoint}`);
const namespace = String(profile.metadata?.stream_namespace || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
const streamId = channel => `dvr_${createHash("sha256")
  .update([profile.connection_type || "dvr", endpoint.hostname, channel, namespace].join(":"))
  .digest("hex").slice(0, 18)}_${channel}`;
const sleep = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
const startedAt = Date.now();
const evidence = { protocol: "observer-push38-gateway-install-health-driver-v1",
  started_at: new Date(startedAt).toISOString(), release_id: RELEASE_ID,
  channels: CHANNELS, endpoint_recorded: false, credentials_recorded: false,
  configuration_writes: 0, runtime_file_writes: 0, checkpoints: [] };
function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}
function persist() {
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  chmodSync(output, 0o600);
}
async function health() {
  const response = await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(4_000) });
  const body = await response.json();
  return { http: response.status, ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null };
}
async function requestPlayback(channel) {
  const response = await fetch(`http://127.0.0.1:18082/camera/${encodeURIComponent(streamId(channel))}/playback`, {
    headers: { "x-video-gateway-secret": secret }, signal: AbortSignal.timeout(4_000)
  }).catch(() => null);
  return { channel, http: response?.status || 0, authorized: response?.ok === true };
}

let targetSeen = false;
while (Date.now() - startedAt < timeoutMs) {
  const current = readJson(join(ROOT, "current.json"), {});
  const state = readJson(join(ROOT, "update-state.json"), {});
  targetSeen ||= current.release_id === RELEASE_ID;
  const playback = current.release_id === RELEASE_ID
    ? await Promise.all(CHANNELS.map(requestPlayback)) : [];
  const observed = await health().catch(() => null);
  const point = { observed_at: new Date().toISOString(), elapsed_ms: Date.now() - startedAt,
    current_release_id: current.release_id || null, update_state: state.state || null,
    playback_authorized: playback.filter(item => item.authorized).length, health: observed };
  evidence.checkpoints.push(point); persist();
  console.log(JSON.stringify({ current_release_id: point.current_release_id,
    update_state: point.update_state, playback_authorized: point.playback_authorized,
    connected: observed?.connected ?? null, progressing: observed?.progressing ?? null }));
  if (current.release_id === RELEASE_ID && state.state === "HEALTHY" && observed?.assigned === 10 &&
    observed.connected === 8 && observed.failed === 2 && observed.empty === 6 &&
    observed.progressing === 8 && observed.stalled === 0) {
    evidence.result = "PASS"; evidence.ended_at = new Date().toISOString(); persist();
    console.log(JSON.stringify({ result: "PASS", release_id: RELEASE_ID, progressing: 8 }));
    process.exit(0);
  }
  if (targetSeen && current.release_id !== RELEASE_ID && ["ROLLED_BACK", "ACTION_REQUIRED"].includes(state.state)) {
    evidence.result = "FAIL_ROLLBACK"; evidence.ended_at = new Date().toISOString(); persist();
    throw new Error("P38_GATEWAY_HEALTH_DRIVER_ROLLBACK");
  }
  await sleep(2_000);
}
evidence.result = "FAIL_TIMEOUT"; evidence.ended_at = new Date().toISOString(); persist();
throw new Error("P38_GATEWAY_HEALTH_DRIVER_TIMEOUT");
