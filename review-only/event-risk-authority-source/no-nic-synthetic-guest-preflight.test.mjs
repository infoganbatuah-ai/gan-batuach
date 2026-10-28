import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RECORDED_QA_SOURCE_IDS } from "./official-qa-source-trust-review.mjs";
import { reviewNoNicSyntheticGuestPlan } from "./no-nic-synthetic-guest-preflight.mjs";

const exact = () => ({ engine: "APPLE_VIRTUALIZATION_FRAMEWORK_NATIVE",
  architecture: "arm64", networkDevices: [], directorySharingDevices: [],
  socketDevices: [], portForwards: [], hostMounts: [],
  customVirtioDevices: [], usbControllers: [], serialPorts: [],
  storageDevices: [
    { role: "FRESH_PRIVATE_SCRATCH_BOOT", kind: "file-backed-virtio-block",
      format: "raw", original: false,
      sourceSha256: RECORDED_QA_SOURCE_IDS.ubuntuArm64Sha256 },
    { role: "OFFLINE_QA_INPUT_ONLY", kind: "file-backed-virtio-block",
      readOnly: true, hostMount: false, networkBacked: false,
      entries: [RECORDED_QA_SOURCE_IDS.ubuntuArm64Sha256,
        RECORDED_QA_SOURCE_IDS.postgresDockerSaveSha256] },
  ], runtime: "NEVER_BOOT_IN_REVIEW_ONLY_PREFLIGHT",
  inputData: "SYNTHETIC_ONLY_NO_BACKUP_NO_EXISTING_DB" });

test("native two-disk no-NIC design is not boot proof", () => {
  const reviewed = reviewNoNicSyntheticGuestPlan(exact());
  assert.equal(reviewed.status, "NATIVE_NO_NIC_DESIGN_REVIEW_ONLY");
  assert.equal(reviewed.noNicDeclared, true);
  assert.equal(reviewed.runtimeProven, false);
  assert.equal(reviewed.guestBootAuthorized, false);
});

test("Lima networks empty is rejected because default network remains", () => {
  const plan = exact(); plan.engine = "LIMA_VZ"; plan.networks = [];
  assert.throws(() => reviewNoNicSyntheticGuestPlan(plan),
    /QA_GUEST_LIMA_DEFAULT_NETWORK_OR_UNSUPPORTED_ENGINE/);
});

test("network, share, socket, serial, forwarding and hidden devices reject", () => {
  for (const field of ["networkDevices", "directorySharingDevices",
    "socketDevices", "portForwards", "hostMounts", "customVirtioDevices",
    "usbControllers", "serialPorts"]) {
    const plan = exact(); plan[field] = [{ hidden: true }];
    assert.throws(() => reviewNoNicSyntheticGuestPlan(plan), /MUST_BE_EMPTY/);
    delete plan[field];
    assert.throws(() => reviewNoNicSyntheticGuestPlan(plan),
      /QA_GUEST_UNREVIEWED_CONFIGURATION_FIELD/);
  }
  const extra = exact(); extra.networks = [];
  assert.throws(() => reviewNoNicSyntheticGuestPlan(extra),
    /QA_GUEST_UNREVIEWED_CONFIGURATION_FIELD/);
});

test("disk count, raw scratch conversion, and exact offline inputs reject", () => {
  for (const mutate of [
    plan => plan.storageDevices.push({ role: "EXTRA" }),
    plan => { plan.storageDevices[0].format = "qcow2"; },
    plan => { plan.storageDevices[0].original = true; },
    plan => { plan.storageDevices[0].sourceSha256 = "0".repeat(64); },
    plan => { plan.storageDevices[1].readOnly = false; },
    plan => { plan.storageDevices[1].networkBacked = true; },
    plan => { plan.storageDevices[1].hostMount = true; },
    plan => plan.storageDevices[1].entries.push("extra"),
    plan => { plan.storageDevices[1].entries[1] = "0".repeat(64); },
    plan => { plan.storageDevices[1].originSocket = "/private/tmp/source.sock"; },
  ]) {
    const plan = exact(); mutate(plan);
    assert.throws(() => reviewNoNicSyntheticGuestPlan(plan), /QA_GUEST_/);
  }
});

test("real data and executable runtime state never pass", () => {
  for (const [field, value] of [["inputData", "REAL_BACKUP"],
    ["runtime", "START_GUEST"], ["architecture", "amd64"]]) {
    const plan = exact(); plan[field] = value;
    assert.throws(() => reviewNoNicSyntheticGuestPlan(plan), /QA_GUEST_/);
  }
});

test("native candidate has no VM construction or start path", () => {
  const source = readFileSync(new URL("./no-nic-synthetic-guest-vz-preflight.swift",
    import.meta.url), "utf8");
  assert.match(source, /config\.networkDevices = \[\]/);
  assert.match(source, /config\.directorySharingDevices = \[\]/);
  assert.match(source, /config\.socketDevices = \[\]/);
  assert.match(source, /config\.serialPorts = \[\]/);
  assert.doesNotMatch(source, /\bVZVirtualMachine\s*\(/);
  assert.doesNotMatch(source, /\.start\s*\(/);
});
