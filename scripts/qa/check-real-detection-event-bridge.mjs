import assert from "node:assert/strict";
import { JournalTracker } from "../../services/video-gateway/journal-tracker.mjs";

const camera = Object.freeze({
  camera_id: "e9f8abf3-5895-494e-b1cf-ea8818602851", stream_id: "dvr_84e4cdf200faab18d9_11",
  monitoring_enabled: true, source_mode: "gateway_test", zone_type: "ENTRANCE",
  allowed_event_types: ["person_detected"], supported_event_types: ["person_detected"]
});
const provenance = Object.freeze({ model: "ssd_mobilenet_v1_10", runtime: "onnxruntime-node", execution_provider: "cpu", expected_sha256: "1fbcf47654165f2e0b5f1bdf3f123b9e9e1128cd6463717767b76ab4b5246f9a" });
const detection = Object.freeze([{ class_id: 1, label: "person", confidence: 0.933, box: [0.1427, 0.2547, 0.8346, 0.5277] }]);
const at = (second) => new Date(Date.UTC(2026, 8, 5, 10, 0, second)).toISOString();
const anchor = (sequence, second) => ({ observer_site_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41", gateway_id: "62df97e2-3c0b-427f-9108-bde029bc10e7", camera_source_id: camera.camera_id, stream_id: camera.stream_id, source_generation: "generation-a", sequence, discontinuity: 0, offset_seconds: 0.25, observed_at: at(second) });

// A real-style two-frame track is enough for passive presence, but a single box is not.
const tracker = new JournalTracker({ personConfirmations: 2 });
assert.deepEqual(tracker.observe(camera, detection, at(0), anchor(100, 0), provenance), []);
const qualified = tracker.observe(camera, detection, at(1), anchor(101, 1), provenance);
assert.equal(qualified.length, 1);
assert.equal(qualified[0].event_type, "person_detected");
assert.deepEqual(qualified[0].model_provenance, provenance);
assert.equal(qualified[0].source_anchor.sequence, 101);

// Wrong source binding and stale/replayed anchors cannot promote an event.
assert.deepEqual(new JournalTracker().observe(camera, detection, at(0), { ...anchor(100, 0), camera_source_id: "wrong" }, provenance), []);
const replay = new JournalTracker();
assert.deepEqual(replay.observe(camera, detection, at(0), anchor(100, 0), provenance), []);
assert.deepEqual(replay.observe(camera, detection, at(1), anchor(100, 1), provenance), []);

// Confidence, duplicate flood control, and mock provenance boundaries remain fail-closed.
assert.deepEqual(new JournalTracker().observe(camera, [{ ...detection[0], confidence: 0.64 }], at(0), anchor(100, 0), provenance), []);
assert.deepEqual(new JournalTracker().observe({ ...camera, source_mode: "local_shadow" }, detection, at(0), anchor(100, 0), provenance), []);
assert.deepEqual(tracker.observe(camera, detection, at(2), anchor(102, 2), provenance), []);

console.log("Real detection bridge checks passed: two-frame person qualification, source-anchor isolation, confidence threshold, dedupe, and mock-path rejection.");
