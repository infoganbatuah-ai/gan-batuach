import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewNoNicGuestControlPlan } from "./no-nic-guest-control-contract.mjs";
import { reviewNoNicSyntheticGuestPlan } from "./no-nic-synthetic-guest-preflight.mjs";

const plan = () => ({ engine: "APPLE_VIRTUALIZATION_FRAMEWORK_NATIVE",
  architecture: "arm64", networkDevices: [], directorySharingDevices: [],
  socketDevices: [], portForwards: [], hostMounts: [], customVirtioDevices: [],
  usbControllers: [], consoleDevices: [], graphicsDevices: [],
  serialPorts: [{ role: "GUEST_RESULT_ONLY", kind: "virtio-console",
    direction: "guest-to-host", attachment: "fresh-private-local-file" }],
  storageDevices: [
    { role: "DISPOSABLE_UBUNTU_BOOT", format: "raw", readOnly: false,
      original: false },
    { role: "OFFLINE_PUBLIC_INPUTS", format: "iso9660", readOnly: true,
      contains: "EXACT_TWO_PUBLIC_FILES_PLUS_SHA256SUMS" },
    { role: "CLOUD_INIT_SYNTHETIC_SEED", format: "iso9660", readOnly: true,
      volume: "CIDATA", contains: "SYNTHETIC_PROBE_ONLY" },
    { role: "DISPOSABLE_RESULT_BLOCK", format: "raw", readOnly: false,
      bytes: 1_048_576, contains: "ZEROES_BEFORE_BOOT" },
  ], runtime: "ONE_BOUNDED_LOCAL_BOOT",
  inputData: "PUBLIC_UBUNTU_AND_SYNTHETIC_SENTINEL_ONLY" });

test("one-way serial, synthetic seed and bounded result disk are explicit", () => {
  assert.deepEqual(reviewNoNicGuestControlPlan(plan()), {
    status: "CONTROL_PLAN_REVIEWED", nics: 0, serials: 1, disks: 4,
    guestBooted: false, guestIsolationProven: false });
});

test("old review-only contract still rejects the expanded device inventory", () => {
  assert.throws(() => reviewNoNicSyntheticGuestPlan(plan()), /QA_GUEST_/);
});

test("all hidden ingress and alternate output devices are denied", () => {
  for (const field of ["networkDevices", "directorySharingDevices",
    "socketDevices", "portForwards", "hostMounts", "customVirtioDevices",
    "usbControllers", "consoleDevices", "graphicsDevices"]) {
    const bad = plan(); bad[field].push({ enabled: true });
    assert.throws(() => reviewNoNicGuestControlPlan(bad), /MUST_BE_EMPTY/);
  }
  for (const change of [
    p => { p.serialPorts[0].direction = "bidirectional"; },
    p => { p.serialPorts.push({}); },
    p => { p.storageDevices[1].readOnly = false; },
    p => { p.storageDevices[2].contains = "BACKUP"; },
    p => { p.storageDevices[3].bytes = 2_097_152; },
    p => { p.storageDevices.push({ role: "HIDDEN" }); },
    p => { p.runtime = "UNBOUNDED"; },
    p => { p.inputData = "EXISTING_DB"; },
    p => { p.hostMounts = ["/"]; },
  ]) {
    const bad = plan(); change(bad);
    assert.throws(() => reviewNoNicGuestControlPlan(bad), /QA_CONTROL_/);
  }
});

test("native runner and pinned NoCloud probe preserve one-way output", () => {
  const swift = readFileSync(new URL("./no-nic-guest-control-runner.swift",
    import.meta.url), "utf8");
  const seed = readFileSync(new URL("./qa-guest-user-data", import.meta.url),
    "utf8");
  assert.match(swift, /config\.networkDevices = \[\]/);
  assert.match(swift, /config\.directorySharingDevices = \[\]/);
  assert.match(swift, /config\.socketDevices = \[\]/);
  assert.match(swift, /VZFileSerialPortAttachment\(url: serial, append: false\)/);
  assert.match(swift, /readOnly: true\)\),\s*VZVirtioBlockDeviceConfiguration/);
  assert.match(seed, /config: disabled/);
  assert.match(seed, /ip -4 route get 198\.51\.100\.1/);
  assert.match(seed, /sha256sum -c SHA256SUMS/);
  assert.match(seed, /DOQA_RESULT nonce=%s status=%s/);
  assert.match(seed, /dd of=\/dev\/vdd bs=4096 conv=fsync/);
  assert.doesNotMatch(seed, /apt-get|curl|wget|ssh|https?:\/\//);
});
