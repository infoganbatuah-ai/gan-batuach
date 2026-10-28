import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDockerlessRootfsLayers } from "./dockerless-rootfs-preflight.mjs";
import { APPROVED_GUEST_ROOTFS_MATERIALIZER, APPROVED_QA_ROOTFS_ARCHIVE_SHA256,
  materializeGuestRootfs,
  reviewGuestRootfsMaterializationInputs, reviewGuestRootfsRollback } from
  "./guest-rootfs-materialization-contract.mjs";
import { QA_POSTGRES_IMAGE_ID } from "./synthetic-qa-image-input.mjs";

const now = 1_800_000_000_000;
function fixture() {
  const layers = Array.from({ length: 29 }, (_, index) => ({
    path: `layers/${String(index).padStart(2, "0")}/layer.tar`, entries: [] }));
  layers[0].entries.push({ path: "bin/postgres", type: "File", size: 32,
    uid: 0, gid: 0, mode: 0o4755 });
  const rootfs = { ...evaluateDockerlessRootfsLayers(layers),
    sourceSha256: APPROVED_QA_ROOTFS_ARCHIVE_SHA256 };
  return {
    image: { archiveIntegrity: "STRUCTURE_AND_DIFF_IDS_VERIFIED",
      imageId: QA_POSTGRES_IMAGE_ID, architecture: "arm64", layerCount: 29,
      bytes: 1_330_063_360, sha256: APPROVED_QA_ROOTFS_ARCHIVE_SHA256 },
    rootfs,
    isolation: { guest: "isolated-restore-qa", egressLockObserved: true,
      egressProbesDenied: true, noHostMounts: true, noProxyEnv: true,
      measuredAtMs: now - 1_000 },
    target: { path: "/var/tmp/do-qa-rootfs-abcdefghijkl", fresh: true,
      empty: true, realpath: "/var/tmp/do-qa-rootfs-abcdefghijkl",
      guestDisk: true, hostMount: false, inode: 12345, processUid: 1000,
      ownerUid: 1000, mode: 0o700, freeBytes: 2 * 1024 ** 3 },
    now
  };
}

test("review contract records exact source and sanitized mode policy but never authorizes extraction", () => {
  const plan = reviewGuestRootfsMaterializationInputs(fixture());
  assert.equal(plan.status, "REVIEW_ONLY_NOT_EXECUTABLE");
  assert.equal(plan.extractionAuthorized, false);
  assert.equal(plan.expectedRegularBytes, 32);
  assert.equal(plan.requiredModePolicy, "STRIP_SETUID_SETGID_AND_NEVER_FOLLOW_LINKS");
  assert.equal(APPROVED_GUEST_ROOTFS_MATERIALIZER, null);
  assert.throws(() => materializeGuestRootfs(fixture()),
    /QA_ROOTFS_MATERIALIZER_DISABLED/);
});

test("wrong image, architecture or unverified layer metadata is rejected", () => {
  const input = fixture();
  for (const image of [
    { ...input.image, imageId: "sha256:" + "0".repeat(64) },
    { ...input.image, architecture: "amd64" },
    { ...input.image, archiveIntegrity: "NOT_VERIFIED" }
  ]) assert.throws(() => reviewGuestRootfsMaterializationInputs({ ...input, image }),
    /QA_ROOTFS_VERIFIED_IMAGE_REQUIRED/);
  assert.throws(() => reviewGuestRootfsMaterializationInputs({ ...input,
    rootfs: { ...input.rootfs, extractionAuthorized: true } }),
  /QA_ROOTFS_METADATA_PLAN_REQUIRED/);
});

test("stale or incomplete egress and host-mount evidence cannot form a plan", () => {
  const input = fixture();
  for (const isolation of [
    { ...input.isolation, egressProbesDenied: false },
    { ...input.isolation, noHostMounts: false },
    { ...input.isolation, measuredAtMs: now - 31_000 }
  ]) assert.throws(() => reviewGuestRootfsMaterializationInputs({ ...input,
    isolation }), /QA_ROOTFS_ISOLATION_EVIDENCE_REQUIRED/);
});

test("target path, ownership, mode, freshness and capacity fail closed", () => {
  const input = fixture();
  for (const target of [
    { ...input.target, path: "/var/tmp/../../Development" },
    { ...input.target, path: "/Volumes/DIGITAL_OBSERVER/Development" },
    { ...input.target, ownerUid: 0 },
    { ...input.target, mode: 0o777 },
    { ...input.target, empty: false },
    { ...input.target, hostMount: true }
  ]) assert.throws(() => reviewGuestRootfsMaterializationInputs({ ...input,
    target }), /QA_ROOTFS_TARGET_/);
  assert.throws(() => reviewGuestRootfsMaterializationInputs({ ...input,
    target: { ...input.target, freeBytes: 32 } }),
  /QA_ROOTFS_TARGET_CAPACITY_UNPROVEN/);
});

test("rollback is inode-specific and never deletes a target", () => {
  const input = fixture();
  const plan = reviewGuestRootfsMaterializationInputs(input);
  assert.equal(reviewGuestRootfsRollback({ plan, target: input.target }),
    "GUEST_LOCAL_CLEANUP_REVIEW_REQUIRED");
  assert.throws(() => reviewGuestRootfsRollback({ plan,
    target: { ...input.target, inode: 12346 } }),
  /QA_ROOTFS_ROLLBACK_TARGET_CHANGED/);
});
