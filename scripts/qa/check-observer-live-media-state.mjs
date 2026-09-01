import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const player = readFileSync("components/digital-observer/observer-live-player.tsx", "utf8");

assert.match(player, /hasVerifiedMediaProgress\(lastCurrentTimeRef\.current, currentTime\)/,
  "player must verify progress from the media clock");
assert.match(player, /if \(markMediaProgress\(videoElement\)\) return;/,
  "heartbeat must repair stale state when currentTime advances without timeupdate");
assert.match(player, /if \(!visibleRef\.current\) return;[\s\S]*elapsedWithoutProgress/,
  "hidden browser throttling must not become a recorder failure");
assert.match(player, /if \(hasStartedRef\.current\) setState\("suspended"\)/,
  "browser rendering may suspend only after playback was verified");
assert.match(player, /active=\{state === "playing" \|\| state === "suspended"\}/,
  "off-screen thumbnail suspension must not claim the background Observer stopped");
assert.match(player, /state === "suspended" \? "תצוגה מושהית"/,
  "the player must distinguish browser rendering suspension from a stream outage");
assert.match(player, /clearTimeout\(retryTimerRef\.current\)/,
  "resumed media must cancel a stale reconnect instead of disrupting healthy playback");

const advances = (previous, current) => Number.isFinite(current) && current > previous + 0.05;
assert.equal(advances(10, 10), false);
assert.equal(advances(10, 10.04), false);
assert.equal(advances(10, 10.2), true);
assert.equal(advances(10, Number.NaN), false);

console.log("Observer live media state checks passed.");
