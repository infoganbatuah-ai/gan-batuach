// Explicit expansion of the earlier no-serial review-only contract. This is
// for one disposable Ubuntu QA boot, not the real PostgreSQL archive.
import assert from "node:assert/strict";

const EMPTY = ["networkDevices", "directorySharingDevices", "socketDevices",
  "portForwards", "hostMounts", "customVirtioDevices", "usbControllers",
  "consoleDevices", "graphicsDevices"];

export function reviewNoNicGuestControlPlan(plan) {
  assert.equal(plan?.engine, "APPLE_VIRTUALIZATION_FRAMEWORK_NATIVE",
    "QA_CONTROL_ENGINE_UNSUPPORTED");
  assert.deepEqual(Object.keys(plan).sort(), ["engine", "architecture", ...EMPTY,
    "serialPorts", "storageDevices", "runtime", "inputData"].sort(),
  "QA_CONTROL_UNREVIEWED_FIELD");
  assert.equal(plan.architecture, "arm64", "QA_CONTROL_ARCH_MISMATCH");
  for (const field of EMPTY) {
    assert.deepEqual(plan[field], [], `QA_CONTROL_${field}_MUST_BE_EMPTY`);
  }
  assert.deepEqual(plan.serialPorts,
    [{ role: "GUEST_RESULT_ONLY", kind: "virtio-console",
      direction: "guest-to-host", attachment: "fresh-private-local-file" }],
  "QA_CONTROL_EXACT_ONE_OUTPUT_SERIAL_REQUIRED");
  assert.deepEqual(plan.storageDevices, [
    { role: "DISPOSABLE_UBUNTU_BOOT", format: "raw", readOnly: false,
      original: false },
    { role: "OFFLINE_PUBLIC_INPUTS", format: "iso9660", readOnly: true,
      contains: "EXACT_TWO_PUBLIC_FILES_PLUS_SHA256SUMS" },
    { role: "CLOUD_INIT_SYNTHETIC_SEED", format: "iso9660", readOnly: true,
      volume: "CIDATA", contains: "SYNTHETIC_PROBE_ONLY" },
    { role: "DISPOSABLE_RESULT_BLOCK", format: "raw", readOnly: false,
      bytes: 1_048_576, contains: "ZEROES_BEFORE_BOOT" },
  ], "QA_CONTROL_EXACT_FOUR_DISKS_REQUIRED");
  assert.equal(plan.runtime, "ONE_BOUNDED_LOCAL_BOOT",
    "QA_CONTROL_RUNTIME_UNBOUNDED");
  assert.equal(plan.inputData, "PUBLIC_UBUNTU_AND_SYNTHETIC_SENTINEL_ONLY",
    "QA_CONTROL_REAL_DATA_FORBIDDEN");
  return Object.freeze({ status: "CONTROL_PLAN_REVIEWED", nics: 0, serials: 1,
    disks: 4, guestBooted: false, guestIsolationProven: false });
}
