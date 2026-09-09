import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const file = "lib/domain/digital-observer/camera-health-model.ts";
const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} }; vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`, { module, console, Date, Set, Map, Object, Number, String, Array, Math });
const health = module.exports; const now = Date.parse("2026-09-09T02:00:00.000Z"); const fresh = "2026-09-09T01:59:30.000Z"; const stale = "2026-09-09T01:40:00.000Z";
const base = { siteId: "site", componentId: "gateway", channelAssignment: "ASSIGNED", physicalCameraAttached: true, sourceState: "CONNECTED", relayState: "PROGRESSING", playbackState: "HEALTHY", aiState: "HEALTHY", componentState: "HEALTHY", authState: "HEALTHY", cloudState: "HEALTHY", recordingState: "AVAILABLE", lastFrameAt: fresh, lastHeartbeatAt: fresh, lastPlaybackAt: fresh, lastInferenceAt: fresh };
const project = (id, extra = {}) => health.projectCameraHealth({ id, name: id, ...base, ...extra }, { now });

const empty = project("empty", { channelAssignment: "CHANNEL_EMPTY", physicalCameraAttached: false });
assert.equal(empty.summary, "EMPTY"); assert.equal(empty.expected, false); assert.deepEqual([...empty.reasons], ["CHANNEL_EMPTY"]);
const oneLoss = project("one-loss", { sourceState: "OFFLINE" }); assert.equal(oneLoss.summary, "OFFLINE"); assert.equal(oneLoss.rootCause.kind, "SOURCE");
const staleRelay = project("stale", { lastFrameAt: stale }); assert.equal(staleRelay.summary, "OFFLINE"); assert.ok(staleRelay.reasons.includes("FRAME_STALE"));
const gatewayFailure = ["a", "b", "c"].map(id => project(id, { componentState: "OFFLINE", lastHeartbeatAt: stale }));
const gatewaySite = health.summarizeSiteHealth(gatewayFailure); assert.equal(gatewaySite.commonCauses.length, 1); assert.equal(gatewaySite.commonCauses[0].affectedCount, 3);
const playback = project("playback", { playbackState: "FAILED" }); assert.equal(playback.summary, "DEGRADED"); assert.equal(playback.dimensions.frame.state, "HEALTHY"); assert.equal(playback.dimensions.ai.state, "HEALTHY");
const ai = project("ai", { aiState: "STALLED" }); assert.equal(ai.summary, "DEGRADED"); assert.equal(ai.dimensions.playback.state, "HEALTHY");
const recovering = project("recovering", { recoveryState: "RECOVERING", sourceState: "OFFLINE" }); assert.equal(recovering.summary, "RECOVERING");
const cloud = project("cloud", { cloudState: "OFFLINE" }); assert.equal(cloud.summary, "DEGRADED"); assert.equal(cloud.dimensions.frame.state, "HEALTHY");
const flap = health.detectHealthFlapping(["HEALTHY", "RECOVERING", "HEALTHY", "OFFLINE", "HEALTHY"].map((state, index) => ({ state, at: new Date(now - (4 - index) * 60_000).toISOString() })), { now }); assert.equal(flap.flapping, true);
const home = health.summarizeSiteHealth([...Array.from({ length: 10 }, (_, i) => project(`dvr-${i}`)), ...Array.from({ length: 6 }, (_, i) => project(`slot-${i}`, { channelAssignment: "CHANNEL_EMPTY", physicalCameraAttached: false })), project("tapo", { componentId: "connector" })]);
assert.equal(home.configuredCapacity, 17); assert.equal(home.expectedPhysicalCameras, 11); assert.equal(home.healthyExpectedCameras, 11); assert.equal(home.emptyChannels, 6); assert.equal(home.expectedAvailability, 1);
for (const [path, needles] of Object.entries({
  "app/api/digital-observer/camera-health/route.ts": ["getObserverSiteAccess", "private, no-store", "loadCameraHealthSnapshot"],
  "lib/domain/digital-observer/fleet-data.ts": ["isExpectedCamera"],
  "app/digital-observer/health/page.tsx": ["צפייה חיה", "ניטור חכם", "ערוץ פנוי"]
})) { const source = readFileSync(path, "utf8"); for (const needle of needles) assert.ok(source.includes(needle), `${path} missing ${needle}`); }
const matrix = readFileSync("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md", "utf8");
const allowed = new Set(["DONE + REAL PROOF", "IMPLEMENTED — NEEDS REAL PROOF", "FOUNDATION", "PARTIAL", "NOT STARTED", "EXTERNAL COVERAGE GAP"]);
const capabilityRows = matrix.split("\n").filter(line => line.startsWith("| ") && allowed.has(line.split("|")[2]?.trim()));
assert.equal(capabilityRows.length, 190); assert.ok(matrix.includes("PUSH 23 reconciliation"));
const roadmap = readFileSync("DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md", "utf8"); const numbered = roadmap.slice(roadmap.indexOf("# CANONICAL NUMBERED ROADMAP"));
const pushNumbers = [...numbered.matchAll(/^\| (\d+) \|/gm)].map(match => Number(match[1])).filter(number => number >= 1 && number <= 52);
assert.deepEqual([...new Set(pushNumbers)].sort((a, b) => a - b), Array.from({ length: 52 }, (_, index) => index + 1));
console.log(JSON.stringify({ status: "PASS", contract: health.CAMERA_HEALTH_CONTRACT, controlled_failures: 9, denominator: { configured_capacity: 17, expected_physical_cameras: 11, empty_channels: 6 }, separate_dimensions: true, common_cause_dedupe: true, flapping: true, tenant_scoped_api: true }));
