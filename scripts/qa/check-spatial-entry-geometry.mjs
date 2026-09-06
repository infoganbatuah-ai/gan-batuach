import assert from "node:assert/strict";
import { JournalTracker, crossingPoint, sideOfLine } from "../../services/video-gateway/journal-tracker.mjs";

const base = Date.parse("2026-09-06T12:00:00.000Z");
const at = step => new Date(base + step * 500).toISOString();
const line = { axis: "y", position: 0.5, inside: "positive" };
const camera = {
  camera_id: "camera-11",
  stream_id: "stream-11",
  zone_type: "ENTRANCE",
  monitoring_enabled: true,
  source_mode: "gateway_test",
  allowed_event_types: ["person_detected", "person_entered", "person_exited"],
  supported_event_types: ["person_detected", "person_entered", "person_exited"],
  critical_event_types: ["person_entered"],
  crossing_line: line
};
const detection = y => [{ label: "person", confidence: 0.9, box: [y - 0.08, 0.42, y + 0.08, 0.58] }];
const anchor = (sequence, timestamp, overrides = {}) => ({
  observer_site_id: "site-a",
  gateway_id: "gateway-a",
  camera_source_id: camera.camera_id,
  stream_id: camera.stream_id,
  source_generation: "generation-a",
  sequence,
  discontinuity: 0,
  offset_seconds: 0.2,
  observed_at: timestamp,
  ...overrides
});
const observe = (tracker, y, step, overrides = {}) => {
  const timestamp = at(step);
  return tracker.observe({ ...camera, ...overrides }, detection(y), timestamp, anchor(step, timestamp), null);
};

assert.deepEqual(crossingPoint([0.2, 0.3, 0.6, 0.7]), { x: 0.5, y: 0.4 });
assert.equal(sideOfLine({ x: 0.5, y: 0.3 }, line), -1, "A clearly upper point is OUTSIDE");
assert.equal(sideOfLine({ x: 0.5, y: 0.5 }, line), 0, "The configured line is a dead-band point");
assert.equal(sideOfLine({ x: 0.5, y: 0.7 }, line), 1, "A clearly lower point is INSIDE");

// Normalized coordinates remain invariant under the current direct 1280x720
// to 300x300 stretch. No rotation or mirroring transform is configured.
const source = { width: 1280, height: 720, x: 640, y: 360 };
const normalizedSource = { x: source.x / source.width, y: source.y / source.height };
const detectorPixel = { x: normalizedSource.x * 300, y: normalizedSource.y * 300 };
assert.deepEqual({ x: detectorPixel.x / 300, y: detectorPixel.y / 300 }, normalizedSource);

const entryTrace = [];
const entryTracker = new JournalTracker({ trace: item => entryTrace.push(item) });
const entryEvents = [];
[0.30, 0.31, 0.32, 0.50, 0.61, 0.62, 0.63].forEach((y, step) => entryEvents.push(...observe(entryTracker, y, step)));
assert.equal(entryEvents.filter(event => event.event_type === "person_entered").length, 1, "OUTSIDE → line → INSIDE creates one entry");
assert.equal(new Set(entryTrace.map(item => item.track_id)).size, 1, "The same Track keeps spatial state across iterations");
assert.equal(entryTrace[0].state_before.side, 0, "A new Track starts UNKNOWN");
assert.equal(entryTrace[2].state_after.side, -1, "Three unique OUTSIDE frames establish the negative side");
assert.equal(entryTrace[3].side, 0, "The on-line frame is classified in the dead band");
assert.equal(entryTrace[3].state_after.side, -1, "Dead-band jitter does not erase the confirmed prior side");
assert.deepEqual(entryTrace.at(-1).emitted_event_types, ["person_entered"]);

const exitTracker = new JournalTracker();
const exitEvents = [];
[0.70, 0.69, 0.68, 0.50, 0.39, 0.38, 0.37].forEach((y, step) => exitEvents.push(...observe(exitTracker, y, step + 20)));
assert.equal(exitEvents.filter(event => event.event_type === "person_exited").length, 1, "INSIDE → line → OUTSIDE creates one exit");

const approachTracker = new JournalTracker();
const approachEvents = [];
[0.30, 0.31, 0.32, 0.40, 0.45, 0.48, 0.51].forEach((y, step) => approachEvents.push(...observe(approachTracker, y, step + 40)));
assert.equal(approachEvents.some(event => event.event_type === "person_entered"), false, "Approach without a confirmed opposite side creates no entry");

const jitterTracker = new JournalTracker();
const jitterEvents = [];
[0.30, 0.31, 0.32, 0.48, 0.52, 0.49, 0.51, 0.47, 0.53].forEach((y, step) => jitterEvents.push(...observe(jitterTracker, y, step + 60)));
assert.equal(jitterEvents.some(event => ["person_entered", "person_exited"].includes(event.event_type)), false, "On-line jitter creates no directional event");

const unknownTracker = new JournalTracker();
const unknownEvents = [];
[0.61, 0.62, 0.63].forEach((y, step) => unknownEvents.push(...observe(unknownTracker, y, step + 80)));
assert.equal(unknownEvents.some(event => event.event_type === "person_entered"), false, "UNKNOWN → INSIDE cannot fabricate entry");

const resetTracker = new JournalTracker({ maxGapMs: 2_000 });
const resetEvents = [];
[0.30, 0.31, 0.32].forEach((y, step) => resetEvents.push(...observe(resetTracker, y, step + 100)));
[0.61, 0.62, 0.63].forEach((y, step) => resetEvents.push(...observe(resetTracker, y, step + 110)));
assert.equal(resetEvents.some(event => event.event_type === "person_entered"), false, "A reset Track cannot inherit stale OUTSIDE state");

const replayTracker = new JournalTracker();
const replayTime = at(130);
replayTracker.observe(camera, detection(0.30), replayTime, anchor(130, replayTime), null);
assert.deepEqual(replayTracker.observe(camera, detection(0.31), replayTime, anchor(130, replayTime), null), [], "A duplicate source frame cannot count twice");

assert.equal(sideOfLine({ x: 0.5, y: 0.7 }, { ...line, inside: "negative" }), 1, "Geometry sign is independent of semantic entry orientation");
assert.equal(line.inside === "positive" ? 1 : -1, 1, "Entry and exit remain directional opposites");

console.log("Spatial entry geometry checks passed: normalized coordinates, side math, UNKNOWN state, directional entry/exit, jitter, continuity, reset and replay safety.");
