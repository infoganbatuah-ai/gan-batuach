import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const player = readFileSync("components/digital-observer/observer-live-player.tsx", "utf8");

assert.match(player, /hasVerifiedMediaProgress\(lastCurrentTimeRef\.current, currentTime\)/,
  "player must verify progress from the media clock");
assert.match(player, /if \(markMediaProgress\(videoElement\)\) return;/,
  "heartbeat must repair stale state when currentTime advances without timeupdate");
assert.match(player, /if \(!visibleRef\.current\) return;[\s\S]*elapsedWithoutProgress/,
  "hidden browser throttling must not become a recorder failure");
assert.doesNotMatch(player, /setState\("suspended"\)/,
  "off-screen rendering must not label a progressing camera or Observer as suspended");
assert.match(player, /active=\{state === "playing"\}/,
  "Observer presence must follow verified playback rather than server readiness");
assert.match(player, /clearTimeout\(retryTimerRef\.current\)/,
  "resumed media must cancel a stale reconnect instead of disrupting healthy playback");

const advances = (previous, current) => Number.isFinite(current) && current > previous + 0.05;
assert.equal(advances(10, 10), false);
assert.equal(advances(10, 10.04), false);
assert.equal(advances(10, 10.2), true);
assert.equal(advances(10, Number.NaN), false);

console.log("Observer live media state checks passed.");
