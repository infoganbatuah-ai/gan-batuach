// Review-only launch-plan rejection gate. The native VZ preflight is separate;
// caller-supplied metadata is NOT measured isolation or authority to boot.
import assert from "node:assert/strict";
import { RECORDED_QA_SOURCE_IDS } from "./official-qa-source-trust-review.mjs";

const ABSENT_DEVICES = ["networkDevices", "directorySharingDevices",
  "socketDevices", "portForwards", "hostMounts", "customVirtioDevices",
  "usbControllers", "serialPorts"];

export function reviewNoNicSyntheticGuestPlan(plan) {
  assert.equal(plan?.engine, "APPLE_VIRTUALIZATION_FRAMEWORK_NATIVE",
    "QA_GUEST_LIMA_DEFAULT_NETWORK_OR_UNSUPPORTED_ENGINE");
  assert.deepEqual(Object.keys(plan).sort(), ["engine", "architecture",
    ...ABSENT_DEVICES, "storageDevices", "runtime", "inputData"].sort(),
  "QA_GUEST_UNREVIEWED_CONFIGURATION_FIELD");
  assert.equal(plan?.architecture, "arm64", "QA_GUEST_ARCH_MISMATCH");
  for (const field of ABSENT_DEVICES) {
    assert.ok(Array.isArray(plan[field]) && plan[field].length === 0,
      `QA_GUEST_${field.toUpperCase()}_MUST_BE_EMPTY`);
  }
  assert.ok(Array.isArray(plan.storageDevices) && plan.storageDevices.length === 2,
    "QA_GUEST_EXACT_TWO_DISKS_REQUIRED");
  const [boot, transfer] = plan.storageDevices;
  assert.ok(boot && typeof boot === "object" && transfer &&
    typeof transfer === "object", "QA_GUEST_DISK_DESCRIPTOR_REQUIRED");
  assert.deepEqual(Object.keys(boot).sort(), ["role", "kind", "format",
    "original", "sourceSha256", "readOnly"].sort(),
  "QA_GUEST_BOOT_DISK_EXTRA_FIELD");
  assert.deepEqual(Object.keys(transfer).sort(), ["role", "kind", "readOnly",
    "hostMount", "networkBacked", "entries"].sort(),
  "QA_GUEST_TRANSFER_DISK_EXTRA_FIELD");
  assert.ok(boot?.role === "FRESH_PRIVATE_SCRATCH_BOOT" &&
    boot.kind === "file-backed-virtio-block" && boot.format === "raw" &&
    boot.original === false && boot.readOnly === false && boot.sourceSha256 ===
      RECORDED_QA_SOURCE_IDS.ubuntuArm64Sha256,
  "QA_GUEST_BOOT_DISK_NOT_QUALIFIED");
  assert.ok(transfer?.role === "OFFLINE_QA_INPUT_ONLY" &&
    transfer.kind === "file-backed-virtio-block" && transfer.readOnly === true &&
    transfer.hostMount === false && transfer.networkBacked === false &&
    Array.isArray(transfer.entries) && transfer.entries.length === 2 &&
    transfer.entries[0] === RECORDED_QA_SOURCE_IDS.ubuntuArm64Sha256 &&
    transfer.entries[1] === RECORDED_QA_SOURCE_IDS.postgresDockerSaveSha256,
  "QA_GUEST_TRANSFER_DISK_NOT_EXACT");
  assert.equal(plan.runtime, "NEVER_BOOT_IN_REVIEW_ONLY_PREFLIGHT",
    "QA_GUEST_RUNTIME_GATE_CHANGED");
  assert.equal(plan.inputData, "SYNTHETIC_ONLY_NO_BACKUP_NO_EXISTING_DB",
    "QA_GUEST_REAL_DATA_FALLBACK_DENIED");
  return Object.freeze({ status: "NATIVE_NO_NIC_DESIGN_REVIEW_ONLY",
    exactDiskCount: 2, noNicDeclared: true, runtimeProven: false,
    currentDiskBytesVerified: false, rawConversionVerified: false,
    offlineTransferImageVerified: false, guestBootAuthorized: false });
}
