import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const gatewayUrl = "http://127.0.0.1:18082";
const keychainService = "com.ganbatuach.video-gateway.runtime";
const mediaRequestTimeoutMs = 20_000;

function keychainSecret(account) {
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", keychainService, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function requireSecret(account) {
  const value = keychainSecret(account);
  if (!value) throw new Error(`Required Keychain item is unavailable: ${account}`);
  return value;
}

function mediaSequence(playlist) {
  const match = playlist.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
  return match ? Number(match[1]) : null;
}

function latestSegment(playlist) {
  return playlist.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).at(-1) || "";
}

function cleanHost(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `rtsp://${raw}`).hostname;
  } catch {
    return raw.replace(/^.+:\/\//, "").replace(/\/.*$/, "").replace(/:.+$/, "");
  }
}

function streamIdFor(profile, channel) {
  const fingerprint = createHash("sha256")
    .update(["dvr", cleanHost(profile.endpoint), channel].join(":"))
    .digest("hex")
    .slice(0, 18);
  return `dvr_${fingerprint}_${channel}`;
}

async function requestPlayback(streamId, gatewaySecret) {
  let response;
  try {
    response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(streamId)}/playback`, {
      headers: { "x-video-gateway-secret": gatewaySecret },
      signal: AbortSignal.timeout(mediaRequestTimeoutMs)
    });
  } catch (error) {
    return { ok: false, reason: error?.name === "TimeoutError" ? "playback_timeout" : "playback_request_failed" };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.playback?.hls_url) return { ok: false, reason: `playback_${response.status}` };

  const playlistUrl = String(payload.playback.hls_url);
  const firstResponse = await fetch(playlistUrl, { signal: AbortSignal.timeout(mediaRequestTimeoutMs) }).catch(() => null);
  if (!firstResponse) return { ok: false, reason: "playlist_timeout" };
  if (!firstResponse.ok) return { ok: false, reason: `playlist_${firstResponse.status}` };
  const firstPlaylist = await firstResponse.text();
  const firstSegment = latestSegment(firstPlaylist);
  if (!firstSegment) return { ok: false, reason: "segment_missing" };
  const segmentResponse = await fetch(new URL(firstSegment, playlistUrl), { signal: AbortSignal.timeout(mediaRequestTimeoutMs) }).catch(() => null);
  if (!segmentResponse) return { ok: false, reason: "segment_timeout" };
  const firstSegmentBuffer = segmentResponse.ok ? Buffer.from(await segmentResponse.arrayBuffer()) : Buffer.alloc(0);
  const segmentBytes = firstSegmentBuffer.byteLength;
  if (!segmentResponse.ok || segmentBytes < 188) return { ok: false, reason: `segment_${segmentResponse.status || "empty"}` };

  await new Promise((resolve) => setTimeout(resolve, 3200));
  const secondResponse = await fetch(playlistUrl, { signal: AbortSignal.timeout(mediaRequestTimeoutMs) }).catch(() => null);
  if (!secondResponse) return { ok: false, reason: "playlist_retry_timeout" };
  if (!secondResponse.ok) return { ok: false, reason: `playlist_retry_${secondResponse.status}` };
  const secondPlaylist = await secondResponse.text();
  const firstSequence = mediaSequence(firstPlaylist);
  const secondSequence = mediaSequence(secondPlaylist);
  const secondSegment = latestSegment(secondPlaylist);
  const secondSegmentResponse = secondSegment
    ? await fetch(new URL(secondSegment, playlistUrl), { signal: AbortSignal.timeout(mediaRequestTimeoutMs) }).catch(() => null)
    : null;
  const secondSegmentBuffer = secondSegmentResponse?.ok ? Buffer.from(await secondSegmentResponse.arrayBuffer()) : Buffer.alloc(0);
  const progressed = (firstSequence !== null && secondSequence !== null && secondSequence > firstSequence)
    || secondSegment !== firstSegment;
  const refreshedMedia = secondSegmentBuffer.length >= 188
    && createHash("sha256").update(secondSegmentBuffer).digest("hex") !== createHash("sha256").update(firstSegmentBuffer).digest("hex");
  if (progressed) return { ok: true, mode: "continuous" };
  if (refreshedMedia) return { ok: true, mode: "recovered" };
  return { ok: false, reason: "media_not_progressing" };
}

const gatewaySecret = requireSecret("gateway_signing_secret");
const profile = JSON.parse(requireSecret("dvr_profile_json"));
const healthResponse = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(10_000) });
const health = await healthResponse.json().catch(() => ({}));
if (!healthResponse.ok || health.status !== "healthy") throw new Error("Local Gateway health check failed");

const channelCount = Math.max(1, Number(profile.channel_count || health.lastDiscovery?.channelCount || 1));
const streamIds = Array.from({ length: channelCount }, (_, index) => streamIdFor(profile, index + 1));
const results = await Promise.all(streamIds.map((streamId) => requestPlayback(streamId, gatewaySecret)));
const healthy = results.filter((result) => result.ok).length;
const continuous = results.filter((result) => result.mode === "continuous").length;
const recovered = results.filter((result) => result.mode === "recovered").length;
const reasons = results.filter((result) => !result.ok).reduce((summary, result) => {
  summary[result.reason] = (summary[result.reason] || 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  mapped: channelCount,
  gatewayConnected: Number(health.streamCount || 0),
  heartbeatHealthy: healthy,
  heartbeatContinuous: continuous,
  heartbeatRecovered: recovered,
  heartbeatUnavailable: channelCount - healthy,
  unavailableReasons: reasons
}));
if (healthy !== Number(health.streamCount || 0)) process.exitCode = 1;
