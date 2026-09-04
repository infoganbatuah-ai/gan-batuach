import assert from "node:assert/strict";
import { JournalTracker } from "../../services/video-gateway/journal-tracker.mjs";

const initial = {
  camera_id: "camera-a", stream_id: "stream-a", zone_type: "ENTRANCE", monitoring_enabled: true,
  allowed_event_types: ["person_detected", "person_entered", "person_exited"],
  crossing_line: { axis: "x", position: 0.5, inside: "positive" }
};
const detection = [{ label: "person", confidence: 0.9, box: [0.1, 0.3, 0.4, 0.4] }];
const at = (second) => new Date(Date.UTC(2026, 7, 31, 10, 0, second)).toISOString();
const sample = (tracker, camera, start) => [0, 1, 2].flatMap(offset => tracker.observe(camera, detection, at(start + offset)));

for (const [name, patch] of [
  ["line position", { crossing_line: { ...initial.crossing_line, position: 0.2 } }],
  ["stream identity", { stream_id: "replacement-stream" }],
  ["zone", { zone_type: "INDOOR" }],
  ["allowed rules", { allowed_event_types: ["person_detected", "person_entered"] }]
]) {
  const tracker = new JournalTracker();
  const before = sample(tracker, initial, 0);
  assert.equal(before.length, 1);
  const after = sample(tracker, { ...initial, ...patch }, 3);
  assert.equal(after.some(event => /_(entered|exited)$/.test(event.event_type)), false, `${name} changes are not physical crossings`);
  assert.equal(after.length, 1, `${name} starts a newly confirmed presence`);
  assert.notEqual(after[0].track_id, before[0].track_id, `${name} must not reuse old spatial evidence`);
}

const stable = new JournalTracker();
sample(stable, initial, 0);
assert.deepEqual(sample(stable, { ...initial, display_name: "Renamed camera", allowed_event_types: [...initial.allowed_event_types].reverse() }, 3), [],
  "Renaming/reordering unchanged rules must not create duplicate presence");

for (const [zone_type, event_type] of [["POOL", "person_near_pool_off_hours"], ["PERIMETER", "unauthorized_night_motion"]]) {
  const tracker = new JournalTracker();
  const camera = { ...initial, zone_type, crossing_line: null, off_hours_active: true, allowed_event_types: [event_type] };
  const events = sample(tracker, camera, 10);
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, event_type);
  assert.equal(events[0].severity, "WARNING");
}
const poolVehicleTracker = new JournalTracker();
const poolVehicle = [{ label: "car", confidence: 0.95, box: [0.1, 0.2, 0.5, 0.6] }];
const poolCamera = { ...initial, zone_type: "POOL", crossing_line: null, off_hours_active: true,
  allowed_event_types: ["person_near_pool_off_hours", "vehicle_entered"] };
assert.deepEqual([0, 1, 2].flatMap(offset => poolVehicleTracker.observe(poolCamera, poolVehicle, at(20 + offset))), [],
  "Pool cameras must never emit vehicle events");
console.log("Tracker configuration checks passed: remapping resets spatial evidence, stationary objects do not become crossings, names/rule order do not duplicate events.");
