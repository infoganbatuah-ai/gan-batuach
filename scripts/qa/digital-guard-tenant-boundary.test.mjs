import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

function routerWithBiometricTripwire() {
  let constructed = 0, processed = 0;
  const router = loadTs("lib/domain/observer-engine/router.ts", {
    "./biometric-engine": { BiometricObserverEngine: class {
      constructor() { constructed++; }
      name = "biometric";
      tenantType = "STANDARD";
      async processFrame() { processed++; return []; }
    } }
  });
  return { ...router, counts: () => ({ constructed, processed }) };
}

const poseFrame = { capturedAt: "2026-08-31T00:00:00.000Z", metadata: {
  skeleton_id: "ephemeral-1", event_type: "person_detected", confidence: 0.9,
  pose_data: { keypoints: [{ joint: "left_wrist", x: 0.2, y: 0.3, confidence: 0.9 }] }
} };

for (const [field, value] of [
  ["tenant_type", "KINDERGARTEN"], ["engine_mode", "kindergarten_skeleton"], ["vision_privacy_mode", "skeleton_only"],
  ["site_type", "kindergarten"], ["business_handles_children", true], ["kindergarten_id", "garden-a"], ["garden_id", "garden-a"]
]) test(`${field} selects skeleton without constructing or invoking biometrics`, async () => {
  const router = routerWithBiometricTripwire();
  const result = await router.processFrameForCamera({ [field]: value }, poseFrame);
  assert.deepEqual(router.counts(), { constructed: 0, processed: 0 });
  assert.equal(result.tenantType, "KINDERGARTEN");
  assert.equal(result.engine, "skeleton");
});

test("missing tenant context must never default to biometric execution", async () => {
  for (const camera of [{}, { tenant_type: "unrecognized" }]) {
    const router = routerWithBiometricTripwire();
    try { await router.processFrameForCamera(camera, poseFrame); } catch { /* Rejecting missing scope is fail-closed. */ }
    assert.deepEqual(router.counts(), { constructed: 0, processed: 0 });
  }
});

test("unknown engine tenant is rejected before any biometric constructor", () => {
  const router = routerWithBiometricTripwire();
  assert.throws(() => router.createObserverEngine("UNRECOGNIZED"));
  assert.deepEqual(router.counts(), { constructed: 0, processed: 0 });
});

test("explicit Standard tenant remains routed to the Standard engine", async () => {
  const router = routerWithBiometricTripwire();
  assert.equal((await router.processFrameForCamera({ tenant_type: "STANDARD", site_type: "home" }, poseFrame)).engine, "biometric");
  assert.deepEqual(router.counts(), { constructed: 1, processed: 1 });
});

test("kindergarten rejects raw frames before any biometric execution", async () => {
  const router = routerWithBiometricTripwire();
  await assert.rejects(router.processFrameForCamera({ tenant_type: "KINDERGARTEN" }, { ...poseFrame, buffer: new Uint8Array([1]) }));
  assert.deepEqual(router.counts(), { constructed: 0, processed: 0 });
});

test("unrecognized identity fields cannot be smuggled inside pose data", async () => {
  for (const extra of [{ face_vector: [0.1, 0.2] }, { licensePlate: "fixture-only" }, { person_name: "fixture-name" }]) {
    const router = routerWithBiometricTripwire();
    await assert.rejects(router.processFrameForCamera({ tenant_type: "KINDERGARTEN" }, {
      ...poseFrame, metadata: { ...poseFrame.metadata, pose_data: { ...poseFrame.metadata.pose_data, ...extra } }
    }));
    assert.deepEqual(router.counts(), { constructed: 0, processed: 0 });
  }
});

test("malformed pose confidence and coordinates are rejected", async () => {
  const router = routerWithBiometricTripwire();
  await assert.rejects(router.processFrameForCamera({ tenant_type: "KINDERGARTEN" }, {
    ...poseFrame, metadata: { ...poseFrame.metadata, pose_data: { keypoints: [{ joint: "left_wrist", x: NaN, y: 0, confidence: 2 }] } }
  }));
});

test("a child-focused business with skeleton privacy remains a usable skeleton tenant", async () => {
  const router = routerWithBiometricTripwire();
  const result = await router.processFrameForCamera({ site_type: "business", business_handles_children: true, vision_privacy_mode: "skeleton_only" }, poseFrame);
  assert.equal(result.engine, "skeleton");
  assert.deepEqual(router.counts(), { constructed: 0, processed: 0 });
});

test("bounding boxes cannot carry identity metadata outside the pose schema", async () => {
  const router = routerWithBiometricTripwire();
  await assert.rejects(router.processFrameForCamera({ tenant_type: "KINDERGARTEN" }, {
    ...poseFrame, metadata: { ...poseFrame.metadata, zone_bounding_box: { x: 0, y: 0, width: 1, height: 1, face_vector: [0.1] } }
  }));
});
