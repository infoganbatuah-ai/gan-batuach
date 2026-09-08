import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const player = readFileSync("components/digital-observer/observer-live-player.tsx", "utf8");
const cameras = readFileSync("app/digital-observer/cameras/page.tsx", "utf8");
const route = readFileSync("app/api/digital-observer/dvr-gateway/route.ts", "utf8");
const installer = readFileSync("scripts/install-existing-software-connector-service.mjs", "utf8");
const northStar = readFileSync("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md", "utf8");
const roadmap = readFileSync("DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md", "utf8");

assert.match(player, /onTimeUpdate[\s\S]*setState\("playing"\)/, "LIVE must require advancing browser media time");
assert.match(player, /data-playback-state=\{state\}/, "player must expose playback health independently");
assert.match(player, /עיבוד המקור עשוי להמשיך/, "playback failure must remain distinct from processing health");
assert.doesNotMatch(cameras, /\$\{connectedCount\} מצלמות פעילות/, "source health must not be presented as verified playback health");
assert.match(route, /connector_device_type === "SOFTWARE_CONNECTOR"[\s\S]*18083[\s\S]*18082/, "playback claims must route to the correct local component");
for (const required of ["device_gateway_id", "device_observer_site_id", "device_refresh_token", "identity_preserved", "cloud_rows_created: false", "18083"]) {
  assert.ok(installer.includes(required), `missing persistent recovery safeguard: ${required}`);
}
assert.doesNotMatch(installer, /console\.log\([^)]*(refresh|password|profile)/i, "installer must not print connector secrets");

const allowedNorthStarStates = new Set([
  "DONE + REAL PROOF", "IMPLEMENTED — NEEDS REAL PROOF", "FOUNDATION", "PARTIAL", "NOT STARTED", "EXTERNAL COVERAGE GAP"
]);
const capabilityRows = northStar.split("\n").filter((line) => {
  if (!line.startsWith("| ")) return false;
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ""));
  return allowedNorthStarStates.has(cells[1]);
});
assert.equal(capabilityRows.length, 190, "North-Star register count must remain deterministic");
assert.ok(capabilityRows.every((line) => line.split("|")[4]?.trim()), "every North-Star capability needs a canonical owner");
const numberedRoadmap = roadmap.slice(roadmap.indexOf("# CANONICAL NUMBERED ROADMAP"));
const pushNumbers = [...numberedRoadmap.matchAll(/^\| (\d+) \|/gm)].map((match) => Number(match[1])).filter((number) => number >= 1 && number <= 52);
assert.deepEqual([...new Set(pushNumbers)].sort((a, b) => a - b), Array.from({ length: 52 }, (_, index) => index + 1), "canonical roadmap must preserve exactly PUSH 1–52");
assert.match(roadmap, /PUSH 19[^\n]*DONE/, "PUSH 19 must retain signed OTA closure evidence");
assert.match(roadmap, /PUSH 20[^\n]*NOT STARTED/, "PUSH 20 must remain not started");

console.log("Post-PUSH18 Live View and North-Star traceability QA PASS (10 controls)");
