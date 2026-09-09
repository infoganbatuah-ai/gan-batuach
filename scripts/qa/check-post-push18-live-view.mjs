import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

function readRepositoryText(path) {
  if (existsSync(path)) return readFileSync(path, "utf8");
  // Some canonical reports are intentionally skip-worktree locally. QA must
  // validate the committed source rather than failing because the report was
  // not materialized in this checkout.
  return execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
}

const player = readRepositoryText("components/digital-observer/observer-live-player.tsx");
const cameras = readRepositoryText("app/digital-observer/cameras/page.tsx");
const route = readRepositoryText("app/api/digital-observer/dvr-gateway/route.ts");
const installer = readRepositoryText("scripts/install-existing-software-connector-service.mjs");
const northStar = readRepositoryText("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md");
const roadmap = readRepositoryText("DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md");

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

console.log("Post-PUSH18 Live View and North-Star traceability QA PASS (8 controls)");
