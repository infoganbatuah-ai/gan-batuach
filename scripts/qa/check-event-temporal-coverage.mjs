import assert from "node:assert/strict";
import { JournalTracker } from "../../services/video-gateway/journal-tracker.mjs";

// Synthetic coordinates and clock only. This is a sampling-limit test, not a
// claim about camera FPS, detector accuracy, or a verified physical boundary.
const base = Date.parse("2026-08-31T12:00:00.000Z");
const camera = {
  camera_id: "fixture-parking", stream_id: "fixture-stream", monitoring_enabled: true,
  zone_type: "PARKING", allowed_event_types: ["vehicle_entered", "vehicle_exited"], supported_event_types: ["vehicle_entered", "vehicle_exited"],
  crossing_line: { axis: "x", position: 0.5, inside: "positive" }
};
const frame = (x, milliseconds) => ({ timestamp: new Date(base + milliseconds).toISOString(),
  detections: [{ label: "car", confidence: 0.95, box: [0.2, x - 0.04, 0.4, x + 0.04] }] });
const trajectory = [0.2, 0.2, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.8, 0.8,
  0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2, 0.2].map((x, i) => frame(x, i * 250))
  .concat([frame(0.2, 10_000), frame(0.2, 20_000)]);
const replay = frames => {
  const tracker = new JournalTracker();
  return frames.flatMap(sample => tracker.observe(camera, sample.detections, sample.timestamp));
};
const fullyObserved = replay(trajectory);
assert(fullyObserved.some(event => event.event_type === "vehicle_entered"), "Observed multi-frame crossing is identifiable");

// A crossing and return between observations produce the same samples as a
// parked vehicle. No tracker can reconstruct the missing movement honestly.
const samplingTimes = [0, 10_000, 20_000];
const sampleAt = (frames, times) => times.map(milliseconds => {
  const timestamp = new Date(base + milliseconds).toISOString();
  const observed = frames.find(sample => sample.timestamp === timestamp);
  assert(observed, "Sampling requires an actual observation at the requested time");
  return observed;
});
const stationaryTrajectory = trajectory.map(sample => frame(0.2, Date.parse(sample.timestamp) - base));
const sparse = sampleAt(trajectory, samplingTimes);
const stationary = sampleAt(stationaryTrajectory, samplingTimes);
assert.notDeepEqual(trajectory, stationaryTrajectory, "The underlying motion histories are different");
assert(trajectory.some(sample => sample.detections[0].box[1] > camera.crossing_line.position), "The moving vehicle actually reaches the inside");
assert.deepEqual(replay(stationaryTrajectory), [], "The fully observed stationary history has no crossing");
assert.deepEqual(sparse, stationary);
assert.deepEqual(replay(sparse), []);
assert.deepEqual(replay(stationary), []);

// Seeing only the new side also cannot establish direction: a new track is
// not evidence that this object crossed the configured boundary.
assert.deepEqual(replay([frame(0.8, 10_000), frame(0.8, 20_000), frame(0.8, 30_000)]), []);
console.log(JSON.stringify({
  test: "temporal_sampling_limit", observed_crossing_detected: true, unobserved_crossing_events: 0,
  live_temporal_coverage: "unknown", sparse_fixture_coverage: "insufficient",
  assessment_scope: "diagnostic_only_not_a_runtime_status_field",
  reason: "Inference completion timestamps do not establish capture cadence; the sparse observations cannot distinguish a brief crossing from no crossing.",
  physical_line_verified: false, live_detector_accuracy_verified: false, event_delivery_verified: false
}));
