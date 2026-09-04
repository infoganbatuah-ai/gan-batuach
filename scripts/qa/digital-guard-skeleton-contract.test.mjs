import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const policy = () => loadTs("lib/domain/observer-engine/policy.ts");
const pose = { keypoints: [{ joint: "left_wrist", x: 0.2, y: 0.4, confidence: 0.9 }] };
const event = { engine: "skeleton", type: "person_detected", skeleton_id: "ephemeral-1", pose_data: pose,
  confidence: 0.9, timestamp: "2026-08-31T10:00:00.000Z",
  metadata: { privacy_mode: "kindergarten_pose_only", face_processing: false, biometric_processing: false } };
const frame = { capturedAt: event.timestamp, metadata: { event_type: event.type, skeleton_id: event.skeleton_id,
  pose_data: pose, confidence: event.confidence } };

function guardedRouter() {
  let biometricCalls = 0;
  const router = loadTs("lib/domain/observer-engine/router.ts", {
    "./biometric-engine": { BiometricObserverEngine: class { constructor() { biometricCalls++; throw Error("Biometrics must never initialize"); } } }
  });
  return { async process(value) {
    try { return await router.processFrameForCamera({ tenant_type: "KINDERGARTEN" }, value); }
    finally { assert.equal(biometricCalls, 0); }
  } };
}

test("body-only skeleton event remains valid and does not initialize biometrics", async () => {
  policy().assertKindergartenEvent(event);
  const result = await guardedRouter().process(frame);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].engine, "skeleton");
  assert.equal(result.events[0].timestamp, event.timestamp);
});

test("skeleton events reject additional top-level fields, even if not in a biometric blacklist", () => {
  for (const fields of [{ resident_name: "fixture-person" }, { licensePlate: "fixture-plate" }, { preview_url: "https://example.invalid/face.jpg" }])
    assert.throws(() => policy().assertKindergartenEvent({ ...event, ...fields }));
});

test("skeleton metadata is a closed privacy contract, not a free-form identity envelope", () => {
  for (const metadata of [
    { ...event.metadata, resident_name: "fixture-person" }, { ...event.metadata, notes: { passport: "fixture" } },
    { ...event.metadata, visitor_label: "fixture-person" }, { ...event.metadata, notes: "fixture person name" },
    { ...event.metadata, face_processing: true }, { ...event.metadata, biometric_processing: "false" },
    { ...event.metadata, privacy_mode: "standard_consent" }, "fixture-person"
  ]) assert.throws(() => policy().assertKindergartenEvent({ ...event, metadata }));
});

test("skeleton event types are an allowlist: biometric, LPR and arbitrary names are rejected", async () => {
  for (const type of ["UNAUTHORIZED_FACE", "KNOWN_FACE", "VEHICLE_IN", "face_match", "plate_recognized", "fixture-person", ""]) {
    assert.throws(() => policy().assertKindergartenEvent({ ...event, type }));
    await assert.rejects(guardedRouter().process({ ...frame, metadata: { ...frame.metadata, event_type: type } }));
  }
});

test("pose labels cannot transport names or other arbitrary text", () => {
  for (const pose_data of [
    { ...pose, posture: "fixture resident name" }, { ...pose, movement: "fixture vehicle plate" },
    { keypoints: [{ ...pose.keypoints[0], joint: "fixture person name" }] }
  ]) assert.throws(() => policy().assertKindergartenEvent({ ...event, pose_data }));
});

test("empty, oversized and duplicate-joint poses are rejected", () => {
  for (const keypoints of [[], Array.from({ length: 1000 }, () => pose.keypoints[0]), [pose.keypoints[0], pose.keypoints[0]]])
    assert.throws(() => policy().assertKindergartenEvent({ ...event, pose_data: { keypoints } }));
});

test("skeleton timestamps are real observation instants, never arbitrary text or fabricated now", async () => {
  for (const timestamp of ["not-a-date", "2026-02-30T10:00:00.000Z", "2026-08-31", ""]) {
    assert.throws(() => policy().assertKindergartenEvent({ ...event, timestamp }));
    await assert.rejects(guardedRouter().process({ ...frame, capturedAt: timestamp }));
  }
  await assert.rejects(guardedRouter().process({ metadata: frame.metadata }));
});

test("skeleton engine cannot invent shared track IDs or coerce malformed confidence", async () => {
  const { skeleton_id: _unused, ...withoutTrack } = frame.metadata;
  await assert.rejects(guardedRouter().process({ ...frame, metadata: withoutTrack }));
  for (const confidence of ["0.9", true, null, NaN, Infinity, -1, 2])
    await assert.rejects(guardedRouter().process({ ...frame, metadata: { ...frame.metadata, confidence } }));
});

test("the exported skeleton engine enforces its own output contract, even outside the router", async () => {
  const { SkeletonObserverEngine } = loadTs("lib/domain/observer-engine/skeleton-engine.ts");
  const engine = new SkeletonObserverEngine();
  assert.equal((await engine.processFrame(frame)).length, 1);
  await assert.rejects(engine.processFrame({ ...frame, capturedAt: "not-a-date" }));
  await assert.rejects(engine.processFrame({ ...frame, metadata: { ...frame.metadata, event_type: "KNOWN_FACE" } }));
});
