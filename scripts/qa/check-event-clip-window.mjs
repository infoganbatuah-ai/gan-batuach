import assert from "node:assert/strict";
import { parseEventClipPlaylist, planEventClipWindow } from "../../services/video-gateway/event-clip-window.mjs";

const playlist = (durations, { first = 100, ended = false, discontinuityAt = -1 } = {}) => [
  "#EXTM3U", "#EXT-X-MEDIA-SEQUENCE:" + first, "#EXT-X-DISCONTINUITY-SEQUENCE:0",
  ...durations.flatMap((duration, i) => [i === discontinuityAt ? "#EXT-X-DISCONTINUITY" : "", `#EXTINF:${duration},`, `segment-${first + i}.ts`]),
  ended ? "#EXT-X-ENDLIST" : ""
].join("\n");
const anchor = { stream_id: "camera-a", source_generation: "relay-instance-a", sequence: 102, discontinuity: 0, offset_seconds: 0.5 };
const input = { streamId: "camera-a", sourceGeneration: "relay-instance-a", anchor, recordingRequired: true, beforeSeconds: 3, afterSeconds: 5 };
const full = playlist([1.5, 2, 1, 2, 3]);
const ready = planEventClipWindow({ ...input, playlistText: full });
assert.equal(ready.status, "ready");
assert.deepEqual(ready.segments.map(segment => segment.sequence), [100, 101, 102, 103, 104]);
assert.equal(ready.trim_start_seconds, 1);
assert.equal(ready.event_offset_seconds, 3);
assert.equal(ready.duration_seconds, 8);
assert.equal(ready.anchor_sequence, 102);
assert.deepEqual(planEventClipWindow({ ...input, recordingRequired: false, playlistText: "invalid" }), { status: "not_required" });
assert.equal(planEventClipWindow({ ...input, playlistText: playlist([1.5, 2, 1]) }).status, "awaiting_future");
assert.equal(planEventClipWindow({ ...input, playlistText: playlist([1.5, 2, 1], { ended: true }) }).reason, "postbuffer_missing");
assert.equal(planEventClipWindow({ ...input, playlistText: playlist([1, 2, 3], { first: 102 }) }).reason, "prebuffer_missing");
assert.equal(planEventClipWindow({ ...input, playlistText: playlist([2, 2, 2], { first: 105 }) }).reason, "anchor_missing", "Expired evidence cannot fall back to newer footage");
assert.equal(planEventClipWindow({ ...input, anchor: { ...anchor, stream_id: "camera-b" }, playlistText: full }).reason, "anchor_invalid");
assert.equal(planEventClipWindow({ ...input, sourceGeneration: "replacement-relay", playlistText: full }).reason, "anchor_invalid", "Restarted sources cannot reuse earlier media sequence evidence");
assert.equal(planEventClipWindow({ ...input, anchor: { ...anchor, offset_seconds: 1 }, playlistText: full }).reason, "anchor_invalid");
assert.equal(planEventClipWindow({ ...input, playlistText: playlist([1.5, 2, 1, 2, 3], { discontinuityAt: 3 }) }).reason, "timeline_discontinuous");
assert.equal(planEventClipWindow({ ...input, anchor: { ...anchor, discontinuity: 1 }, playlistText: playlist([1.5, 2, 1, 2, 3], { discontinuityAt: 2 }) }).reason, "timeline_discontinuous");
assert.equal(planEventClipWindow({ ...input, afterSeconds: Infinity, playlistText: full }).reason, "window_invalid");
for (const invalid of [
  full.replace("segment-100.ts", "https://private.invalid/video.ts"),
  full.replace("segment-100.ts", "../video.ts"),
  full.replace("segment-101.ts", "segment-100.ts"),
  full.replace("#EXTINF:1.5,", "#EXTINF:NaN,"),
  full.replace("#EXTINF:1.5,", "#EXTINF:-1,"),
  full.replace("#EXTINF:1.5,", "#EXT-X-KEY:METHOD=AES-128\n#EXTINF:1.5,"),
  full.replace("#EXTINF:1.5,", "#EXT-X-BYTERANGE:10\n#EXTINF:1.5,")
]) assert.equal(parseEventClipPlaylist(invalid, "camera-a"), null);

// Deterministic variable-duration windows: the anchor must land exactly at the
// requested event offset, even when segment lengths are not one second each.
let seed = 731;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let trial = 0; trial < 1000; trial++) {
  const durations = Array.from({ length: 30 }, () => 0.1 + Math.floor(random() * 390) / 100);
  const position = 10 + Math.floor(random() * 10);
  const offset = durations[position] * random();
  const beforeSeconds = random() * 5, afterSeconds = random() * 5;
  const plan = planEventClipWindow({ ...input, playlistText: playlist(durations), beforeSeconds, afterSeconds,
    anchor: { ...anchor, sequence: 100 + position, offset_seconds: offset } });
  assert.equal(plan.status, "ready");
  const start = plan.segments[0].sequence - 100;
  const eventWithinSegments = durations.slice(start, position).reduce((sum, value) => sum + value, offset);
  const total = plan.segments.reduce((sum, segment) => sum + segment.duration_seconds, 0);
  assert(Math.abs(eventWithinSegments - plan.trim_start_seconds - beforeSeconds) < 1e-9);
  assert(plan.trim_start_seconds >= 0);
  assert(plan.trim_start_seconds + plan.duration_seconds <= total + 1e-9);
}
console.log("Event clip window planning passed: exact source anchor, real segment durations, bounded before/after window, passive skip, no future/stale/cross-camera substitution, discontinuity and URI rejection. No capture or live integration performed.");
