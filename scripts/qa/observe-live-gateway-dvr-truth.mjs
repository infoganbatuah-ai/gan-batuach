// Bounded real-media proof after the authorized DVR endpoint reconciliation.
// Uses only the installed Gateway loopback playback contract and stores
// redacted aggregates in the restricted evidence directory.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const exec = promisify(execFile);
const AVAILABLE = Object.freeze([1, 3, 4, 5, 6, 7, 10, 11]);
const UPSTREAM_UNAVAILABLE = Object.freeze([2, 8]);
const EMPTY = Object.freeze([9, 12, 13, 14, 15, 16]);
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const durationMs = Number(option("duration-ms") || 5 * 60_000);
const intervalMs = Number(option("interval-ms") || 30_000);
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted) || existsSync(output)) throw new Error("P38_DVR_TRUTH_RESTRICTED_NEW_OUTPUT_REQUIRED");
if (!Number.isFinite(durationMs) || durationMs < 60_000 || durationMs > 10 * 60_000
  || !Number.isFinite(intervalMs) || intervalMs < 15_000 || intervalMs > 60_000)
  throw new Error("P38_DVR_TRUTH_BOUNDED_WINDOW_REQUIRED");

const store = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const profile = JSON.parse(store.read("dvr_profile_json"));
const secret = store.read("gateway_signing_secret");
if (!profile?.endpoint || !secret) throw new Error("P38_DVR_TRUTH_INSTALLED_CONFIGURATION_UNAVAILABLE");
const endpoint = new URL(String(profile.endpoint).includes("://") ? profile.endpoint : `http://${profile.endpoint}`);
const namespace = String(profile.metadata?.stream_namespace || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
const streamId = (channel) => `dvr_${createHash("sha256")
  .update([profile.connection_type || "dvr", endpoint.hostname, channel, namespace].join(":"))
  .digest("hex").slice(0, 18)}_${channel}`;
const base = "http://127.0.0.1:18082";
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function health() {
  const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  return { http: response.status, ok: body.ok === true, status: body.status || null,
    failed_stream_count: body.failedStreamCount ?? null,
    discovery: body.lastDiscovery ? { assigned: body.lastDiscovery.assignedCount,
      connected: body.lastDiscovery.connectedCount, failed: body.lastDiscovery.failedAssignedCount,
      empty: body.lastDiscovery.unassignedCount, checked_at: body.lastDiscovery.checkedAt } : null,
    media: body.mediaHeartbeat ? { progressing: body.mediaHeartbeat.progressingRelays,
      stalled: body.mediaHeartbeat.stalledRelays, active: body.mediaHeartbeat.activeRelays,
      channels: (body.mediaHeartbeat.inputs || []).map((item) => ({ channel: item.channel,
        progressing: item.progressing, bytes: item.bytes ?? item.input_bytes ?? null,
        chunks: item.chunks ?? item.input_chunks ?? null })).sort((a, b) => a.channel - b.channel) } : null,
    session: body.recorderSessionLifecycle ? { login_attempts: body.recorderSessionLifecycle.login_attempts,
      login_succeeded: body.recorderSessionLifecycle.login_succeeded,
      rotations: body.recorderSessionLifecycle.rotations,
      active_sessions: body.recorderSessionLifecycle.active_sessions,
      last_rotation_reason: body.recorderSessionLifecycle.last_rotation_reason } : null };
}
async function playback(channel) {
  const response = await fetch(`${base}/camera/${encodeURIComponent(streamId(channel))}/playback`, {
    headers: { "x-video-gateway-secret": secret }, signal: AbortSignal.timeout(10_000)
  }).catch(() => null);
  const body = response ? await response.json().catch(() => null) : null;
  const url = body?.playback?.hls_url;
  if (!response?.ok || !url) return { channel, authorized: false, playlist: false, decoded: false };
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("P38_DVR_TRUTH_NON_LOOPBACK_PLAYBACK_REJECTED");
  let playlistStatus = 0, segmentBytes = 0;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline && !segmentBytes) {
    const playlistResponse = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    playlistStatus = playlistResponse?.status || 0;
    const playlist = playlistResponse?.ok ? await playlistResponse.text() : "";
    const segment = playlist.match(/^(segment-\d+\.ts\?token=.+)$/m)?.[1];
    if (segment) {
      const segmentResponse = await fetch(new URL(segment, url), { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (segmentResponse?.ok) segmentBytes = (await segmentResponse.arrayBuffer()).byteLength;
    }
    if (!segmentBytes) await sleep(1000);
  }
  let decoded = false;
  if (segmentBytes > 0) {
    try {
      await exec("/opt/homebrew/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", url,
        "-frames:v", "1", "-f", "null", "-"], { timeout: 25_000, maxBuffer: 1024 * 1024 });
      decoded = true;
    } catch {}
  }
  return { channel, authorized: true, playlist: playlistStatus === 200,
    segment_bytes: segmentBytes, decoded };
}

const startedAt = Date.now();
const evidence = { protocol: "observer-push38-live-gateway-dvr-truth-v1",
  started_at: new Date(startedAt).toISOString(), duration_target_ms: durationMs,
  expected_physical: 10, source_available: AVAILABLE, upstream_unavailable: UPSTREAM_UNAVAILABLE,
  empty: EMPTY, endpoint_recorded: false, credentials_recorded: false, checkpoints: [] };
let sequence = 0;
while (Date.now() - startedAt < durationMs) {
  const media = await Promise.all(AVAILABLE.map(playback));
  const unavailable = await Promise.all(UPSTREAM_UNAVAILABLE.map(async (channel) => {
    const response = await fetch(`${base}/camera/${encodeURIComponent(streamId(channel))}/playback`, {
      headers: { "x-video-gateway-secret": secret }, signal: AbortSignal.timeout(5000)
    }).catch(() => null);
    return { channel, denied_or_unavailable: !response?.ok, http: response?.status || 0 };
  }));
  const point = { sequence: ++sequence, observed_at: new Date().toISOString(), elapsed_ms: Date.now() - startedAt,
    health: await health(), media, unavailable, host_load: loadavg() };
  evidence.checkpoints.push(point);
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  chmodSync(output, 0o600);
  console.log(JSON.stringify({ sequence: point.sequence, observed_at: point.observed_at,
    media_passed: media.filter((item) => item.decoded).length, discovery: point.health.discovery,
    progressing: point.health.media?.progressing, status: point.health.status }));
  await sleep(intervalMs);
}
evidence.ended_at = new Date().toISOString();
evidence.duration_ms = Date.now() - startedAt;
evidence.summary = {
  channels_ever_decoded: AVAILABLE.filter((channel) => evidence.checkpoints.some((point) =>
    point.media.some((item) => item.channel === channel && item.decoded))),
  all_discovery_truthful: evidence.checkpoints.every((point) => point.health.discovery?.assigned === 10
    && point.health.discovery?.connected === 8 && point.health.discovery?.failed === 2
    && point.health.discovery?.empty === 6),
  upstream_unavailable_never_authorized: evidence.checkpoints.every((point) =>
    point.unavailable.every((item) => item.denied_or_unavailable)),
  aggregate_health_truthful: evidence.checkpoints.every((point) => point.health.ok === false
    && point.health.status === "degraded"),
  endpoint_recorded: false,
  credential_recorded: false
};
evidence.result = evidence.summary.channels_ever_decoded.length === AVAILABLE.length
  && evidence.summary.all_discovery_truthful && evidence.summary.upstream_unavailable_never_authorized
  ? "MEDIA_AND_SOURCE_TRUTH_PASS" : "FAIL";
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
chmodSync(output, 0o600);
console.log(JSON.stringify({ result: evidence.result, duration_ms: evidence.duration_ms,
  checkpoints: evidence.checkpoints.length, channels_decoded: evidence.summary.channels_ever_decoded.length,
  aggregate_health_truthful: evidence.summary.aggregate_health_truthful,
  evidence_sha256: createHash("sha256").update(readFileSync(output)).digest("hex") }));
if (evidence.result !== "MEDIA_AND_SOURCE_TRUTH_PASS") process.exitCode = 1;
