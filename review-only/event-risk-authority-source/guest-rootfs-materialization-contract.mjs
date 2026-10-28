// Review-only contract. There is deliberately no extraction implementation or
// filesystem write path. This must not be imported by the live QA runner.
import assert from "node:assert/strict";
import { posix } from "node:path";
import { MAX_QA_IMAGE_TAR_BYTES, QA_POSTGRES_IMAGE_ID } from
  "./synthetic-qa-image-input.mjs";

export const APPROVED_GUEST_ROOTFS_MATERIALIZER = null;
export const APPROVED_QA_ROOTFS_ARCHIVE_SHA256 =
  "51c3b993f6ec02b579665fcd56c4f126107dd474e97f6fcf723e66c703c30e27";
const RESERVE_BYTES = 1024 ** 3;

function assertGuestScratchTarget(target) {
  assert.ok(typeof target?.path === "string" &&
    /^\/var\/tmp\/do-qa-rootfs-[a-z0-9]{12,64}$/.test(target.path) &&
    posix.normalize(target.path) === target.path,
  "QA_ROOTFS_TARGET_PATH_INVALID");
  assert.ok(target.fresh === true && target.empty === true &&
    target.realpath === target.path && target.guestDisk === true &&
    target.hostMount === false && Number.isSafeInteger(target.inode) &&
    target.inode > 0 && Number.isSafeInteger(target.processUid) &&
    target.processUid >= 0 && target.ownerUid === target.processUid &&
    target.mode === 0o700, "QA_ROOTFS_TARGET_NOT_FRESH_PRIVATE_GUEST_DISK");
  // These fields are design inputs, not evidence: a future guest-local helper
  // must measure them using dirfd/lstat immediately before every write.
}

export function reviewGuestRootfsMaterializationInputs({ image, rootfs, isolation,
  target, now = Date.now() }) {
  assert.ok(image?.archiveIntegrity === "STRUCTURE_AND_DIFF_IDS_VERIFIED" &&
    image.imageId === QA_POSTGRES_IMAGE_ID && image.architecture === "arm64" &&
    image.sha256 === APPROVED_QA_ROOTFS_ARCHIVE_SHA256 &&
    image.layerCount === 29 && image.bytes === 1_330_063_360 &&
    image.bytes <= MAX_QA_IMAGE_TAR_BYTES,
  "QA_ROOTFS_VERIFIED_IMAGE_REQUIRED");
  assert.ok(rootfs?.status === "OFFLINE_METADATA_ONLY" &&
    rootfs.extractionAuthorized === false && rootfs.layerCount === 29 &&
    rootfs.sourceSha256 === image.sha256 &&
    Number.isSafeInteger(rootfs.members) && rootfs.members > 0 &&
    rootfs.members <= 100_000 && Number.isSafeInteger(rootfs.regularBytes) &&
    rootfs.regularBytes > 0 && rootfs.regularBytes <= 2 * 1024 ** 3 &&
    Number.isSafeInteger(rootfs.privilegedModes) &&
    rootfs.privilegedModes >= 0,
  "QA_ROOTFS_METADATA_PLAN_REQUIRED");
  assert.ok(isolation?.guest === "isolated-restore-qa" &&
    isolation.egressLockObserved === true && isolation.egressProbesDenied === true &&
    isolation.noHostMounts === true && isolation.noProxyEnv === true &&
    Number.isSafeInteger(isolation.measuredAtMs) && Number.isSafeInteger(now) &&
    isolation.measuredAtMs <= now && now - isolation.measuredAtMs <= 30_000,
  "QA_ROOTFS_ISOLATION_EVIDENCE_REQUIRED");
  assertGuestScratchTarget(target);
  assert.ok(Number.isSafeInteger(target.freeBytes) &&
    target.freeBytes >= rootfs.regularBytes + RESERVE_BYTES,
  "QA_ROOTFS_TARGET_CAPACITY_UNPROVEN");
  return Object.freeze({ status: "REVIEW_ONLY_NOT_EXECUTABLE",
    extractionAuthorized: false, sourceImageId: image.imageId,
    sourceSha256: image.sha256, targetPath: target.path,
    targetInode: target.inode, expectedMembers: rootfs.members,
    expectedRegularBytes: rootfs.regularBytes,
    requiredModePolicy: "STRIP_SETUID_SETGID_AND_NEVER_FOLLOW_LINKS",
    rollback: "DELETE_EXACT_GUEST_SCRATCH_INODE_ONLY_AFTER_REMEASUREMENT" });
}

export function reviewGuestRootfsRollback({ plan, target }) {
  assert.ok(plan?.status === "REVIEW_ONLY_NOT_EXECUTABLE" &&
    plan.extractionAuthorized === false, "QA_ROOTFS_ROLLBACK_PLAN_INVALID");
  assertGuestScratchTarget(target);
  assert.ok(target.path === plan.targetPath && target.inode === plan.targetInode,
    "QA_ROOTFS_ROLLBACK_TARGET_CHANGED");
  return "GUEST_LOCAL_CLEANUP_REVIEW_REQUIRED";
}

export function materializeGuestRootfs() {
  assert.equal(APPROVED_GUEST_ROOTFS_MATERIALIZER, null,
    "QA_ROOTFS_MATERIALIZER_GATE_CHANGED_WITHOUT_REVIEW");
  throw new Error("QA_ROOTFS_MATERIALIZER_DISABLED");
}
