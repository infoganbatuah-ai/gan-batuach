import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const gatewayUrl = "http://127.0.0.1:18082";
const keychainService = "com.ganbatuach.video-gateway.runtime";

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

async function requestPlayback(streamId, gatewaySecret) {
  const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(streamId)}/playback`, {
    headers: { "x-video-gateway-secret": gatewaySecret }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.playback?.hls_url) return { ok: false, reason: `playback_${response.status}` };

  const playlistUrl = String(payload.playback.hls_url);
  const firstResponse = await fetch(playlistUrl);
  if (!firstResponse.ok) return { ok: false, reason: `playlist_${firstResponse.status}` };
  const firstPlaylist = await firstResponse.text();
  const firstSegment = latestSegment(firstPlaylist);
  if (!firstSegment) return { ok: false, reason: "segment_missing" };
  const segmentResponse = await fetch(new URL(firstSegment, playlistUrl));
  const firstSegmentBuffer = segmentResponse.ok ? Buffer.from(await segmentResponse.arrayBuffer()) : Buffer.alloc(0);
  const segmentBytes = firstSegmentBuffer.byteLength;
  if (!segmentResponse.ok || segmentBytes < 188) return { ok: false, reason: `segment_${segmentResponse.status || "empty"}` };

  await new Promise((resolve) => setTimeout(resolve, 3200));
  const secondResponse = await fetch(playlistUrl);
  if (!secondResponse.ok) return { ok: false, reason: `playlist_retry_${secondResponse.status}` };
  const secondPlaylist = await secondResponse.text();
  const firstSequence = mediaSequence(firstPlaylist);
  const secondSequence = mediaSequence(secondPlaylist);
  const secondSegment = latestSegment(secondPlaylist);
  const secondSegmentResponse = secondSegment ? await fetch(new URL(secondSegment, playlistUrl)) : null;
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
const password = requireSecret("dvr_password");
const discoveryResponse = await fetch(`${gatewayUrl}/dvr/connect`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret },
  body: JSON.stringify({
    connection_type: "dvr",
    endpoint: profile.endpoint,
    port: profile.port,
    username: profile.username,
    password,
    metadata: {
      vendor: profile.vendor,
      expected_channel_count: profile.channel_count,
      read_only_requested: true
    }
  })
});
const discovery = await discoveryResponse.json().catch(() => ({}));
if (!discoveryResponse.ok) throw new Error("Read-only DVR discovery failed");

const channels = Array.isArray(discovery.channels) ? discovery.channels : [];
const connected = channels.filter((channel) => channel.status === "connected" && (channel.gateway_stream_id || channel.stream_id));
const results = await Promise.all(connected.map((channel) => requestPlayback(String(channel.gateway_stream_id || channel.stream_id), gatewaySecret)));
const healthy = results.filter((result) => result.ok).length;
const continuous = results.filter((result) => result.mode === "continuous").length;
const recovered = results.filter((result) => result.mode === "recovered").length;
const reasons = results.filter((result) => !result.ok).reduce((summary, result) => {
  summary[result.reason] = (summary[result.reason] || 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  discovered: channels.length,
  connected: connected.length,
  heartbeatHealthy: healthy,
  heartbeatContinuous: continuous,
  heartbeatRecovered: recovered,
  heartbeatUnavailable: connected.length - healthy,
  unavailableReasons: reasons
}));
if (healthy !== connected.length) process.exitCode = 1;
