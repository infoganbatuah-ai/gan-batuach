// Local QA image input only. This module never invokes Docker or a provider.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, closeSync, createReadStream, fstatSync, lstatSync, openSync,
  realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, sep } from "node:path";

export const QA_POSTGRES_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.167";
export const QA_POSTGRES_IMAGE_ID =
  "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
export const MAX_QA_IMAGE_TAR_BYTES = 2 * 1024 ** 3;
const SOURCE_ROOT = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach";
const PROJECT_ROOT = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach";
const HEX64 = /^[a-f0-9]{64}$/;

function within(path, root) { return path === root || path.startsWith(root + sep); }

export function assertQaImageTransferBoundary(proof) {
  for (const field of ["encrypted", "noHostMounts", "noProxyEnv",
    "guestIpv4OutputDrop", "guestIpv6OutputDrop", "guestIpv4ForwardDrop",
    "guestIpv6ForwardDrop", "ipv4EgressProbeDenied", "ipv6EgressProbeDenied",
    "dnsResolutionProbeDenied", "dnsHasNoAllowRule"]) {
    assert.equal(proof?.[field], true, `QA_IMAGE_${field.toUpperCase()}_UNPROVEN`);
  }
}

export function assertQaImageTargetCapacity(freeBytes, imageBytes) {
  assert.ok(Number.isSafeInteger(freeBytes) && Number.isSafeInteger(imageBytes) &&
    imageBytes > 0 && imageBytes <= MAX_QA_IMAGE_TAR_BYTES &&
    freeBytes >= 2 * imageBytes + 1024 ** 3, "QA_IMAGE_TARGET_CAPACITY_UNPROVEN");
}

export function parseQaImageArguments(args) {
  assert.ok(Array.isArray(args) && args.length === 4, "QA_IMAGE_ARGUMENTS_REQUIRED");
  const [flagPath, tarPath, flagDigest, sha256] = args;
  assert.equal(flagPath, "--qa-image-tar", "QA_IMAGE_ARGUMENTS_INVALID");
  assert.equal(flagDigest, "--qa-image-sha256", "QA_IMAGE_ARGUMENTS_INVALID");
  assert.ok(typeof tarPath === "string" && isAbsolute(tarPath), "QA_IMAGE_PATH_NOT_ABSOLUTE");
  assert.match(sha256, HEX64, "QA_IMAGE_DIGEST_REQUIRED");
  return { tarPath, sha256 };
}

export async function verifyIndependentQaImage({ tarPath, sha256 }) {
  assert.ok(typeof tarPath === "string" && isAbsolute(tarPath), "QA_IMAGE_PATH_NOT_ABSOLUTE");
  assert.match(sha256, HEX64, "QA_IMAGE_DIGEST_REQUIRED");
  const absolute = join(realpathSync(dirname(tarPath)), basename(tarPath));
  const actual = realpathSync(tarPath);
  assert.equal(actual, absolute, "QA_IMAGE_SYMLINK_DENIED");
  assert.ok(!within(actual, SOURCE_ROOT) && !within(actual, PROJECT_ROOT),
    "QA_IMAGE_SOURCE_NOT_INDEPENDENT");
  const parent = lstatSync(dirname(actual));
  assert.ok(parent.isDirectory() && parent.uid === process.getuid() &&
    (parent.mode & 0o077) === 0, "QA_IMAGE_PARENT_NOT_PRIVATE");
  const before = lstatSync(actual);
  assert.ok(before.isFile() && before.nlink === 1 && before.uid === process.getuid() &&
    (before.mode & 0o077) === 0 && before.size > 0 &&
    before.size <= MAX_QA_IMAGE_TAR_BYTES, "QA_IMAGE_FILE_UNSAFE");
  const fd = openSync(actual, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd);
    assert.equal(opened.ino, before.ino, "QA_IMAGE_CHANGED_DURING_OPEN");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(actual, { fd, autoClose: false })) hash.update(chunk);
    const after = fstatSync(fd);
    assert.ok(after.ino === before.ino && after.size === before.size &&
      after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs,
    "QA_IMAGE_CHANGED_DURING_READ");
    assert.equal(hash.digest("hex"), sha256, "QA_IMAGE_DIGEST_MISMATCH");
  } finally { closeSync(fd); }
  return Object.freeze({ tarPath: actual, sha256, bytes: before.size,
    imageReference: QA_POSTGRES_IMAGE, imageId: QA_POSTGRES_IMAGE_ID,
    provenance: "OWNER_ATTESTATION_REQUIRED" });
}
