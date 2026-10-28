// Review-only component restore contract. No live decrypt/restore adapter exists.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, createReadStream, lstatSync, openSync, closeSync, readSync, realpathSync, statfsSync, fstatSync, readFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_ENCRYPTED_BYTES, MIN_INTERNAL_FREE_BYTES, acquireCaptureLock } from "./component-backup-contract.mjs";

export const COMPONENT_FILES = Object.freeze({
  "database:_supabase": "_supabase.age",
  "database:gan_batuach_baseline_builder_v2": "gan_batuach_baseline_builder_v2.age",
  "database:postgres": "postgres.age",
  globals: "globals.age",
  "storage-bytes": "storage-bytes.age",
});
export const PINNED_ORIGINAL = Object.freeze({
  expectedScope: "original-isolated-development",
  expectedRecipientSha256: "1fc9645eff132753e75a26eb0856b6f9abe0a26af6002625346832a8a89d97b4",
  expectedSourceContainerId: "7c30223f1a6f2b7be78e85d2ba44a5eeccb0704a3113f36c03bb8e6f84744d0a",
});
const SHA = /^[a-f0-9]{64}$/;
const ageHeader = Buffer.from("age-encryption.org/v1");

function privateRegular(path) {
  const s = lstatSync(path);
  assert.ok(s.isFile() && s.uid === process.getuid() && (s.mode & 0o077) === 0,
    "RESTORE_FILE_NOT_PRIVATE_REGULAR");
  return s;
}
function privateDirectory(path) {
  const s = lstatSync(path);
  assert.ok(s.isDirectory() && s.uid === process.getuid() && (s.mode & 0o077) === 0,
    "RESTORE_DIRECTORY_NOT_PRIVATE");
  return s;
}
function freeBytes(path) {
  const fs = statfsSync(path);
  return Number(fs.bavail) * Number(fs.bsize);
}
function within(path, root) { return path === root || path.startsWith(root + sep); }

export function assertDisjointTarget(target, forbiddenRoots) {
  privateDirectory(target);
  const actual = realpathSync(target);
  for (const root of forbiddenRoots) {
    const forbidden = realpathSync(root);
    assert.ok(!within(actual, forbidden) && !within(forbidden, actual), "RESTORE_TARGET_SOURCE_ALIAS");
  }
  return actual;
}

export function assertFreshIsolatedTarget(proof, { now = Date.now() } = {}) {
  assert.ok(proof && Number.isSafeInteger(proof.checkedAtMs) &&
    now - proof.checkedAtMs >= 0 && now - proof.checkedAtMs <= 60_000,
  "RESTORE_TARGET_PROOF_STALE");
  for (const field of ["encrypted", "noHostMounts", "noProxyEnv", "originalVolumesAbsent",
    "guestIpv4OutputDrop", "guestIpv6OutputDrop", "guestIpv4ForwardDrop", "guestIpv6ForwardDrop",
    "ipv4EgressProbeDenied", "ipv6EgressProbeDenied", "dnsResolutionProbeDenied",
    "egressProbesDeniedAfterReboot", "bootRouteAbsentBeforePolicy", "bootIpv6RouteAbsentBeforePolicy",
    "postgresTool", "pgNetworkNone", "storageNetworkNone"]) {
    assert.equal(proof[field], true, `RESTORE_TARGET_${field.toUpperCase()}_UNPROVEN`);
  }
  assert.equal(proof.scratchCleaned, false, "RESTORE_TARGET_ALREADY_CLEANED");
}

export async function verifyComponentCiphertexts(receiptPath, {
  expectedScope, expectedRecipientSha256, expectedSourceContainerId,
  deadlineAt = Date.now() + 180_000,
  availableBytes = freeBytes,
} = {}) {
  assert.ok(Date.now() < deadlineAt, "RESTORE_PREFLIGHT_DEADLINE");
  const directory = dirname(receiptPath);
  privateDirectory(directory);
  const receiptStat = privateRegular(receiptPath);
  assert.ok(receiptStat.size > 0 && receiptStat.size <= 128 * 1024, "RESTORE_RECEIPT_SIZE_CAP");
  const receiptFd = openSync(receiptPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let receipt;
  try {
    assert.equal(fstatSync(receiptFd).ino, receiptStat.ino, "RESTORE_RECEIPT_RACE");
    receipt = JSON.parse(readFileSync(receiptFd, "utf8"));
    const after = fstatSync(receiptFd);
    assert.ok(after.ino === receiptStat.ino && after.size === receiptStat.size &&
      after.mtimeMs === receiptStat.mtimeMs && after.ctimeMs === receiptStat.ctimeMs,
    "RESTORE_RECEIPT_CHANGED_DURING_READ");
  } finally { closeSync(receiptFd); }
  assert.equal(receipt.status, "COMPONENT_BACKUPS_ONLY");
  assert.equal(receipt.scope, expectedScope, "RESTORE_SCOPE_MISMATCH");
  assert.equal(receipt.publicRecipientSha256, expectedRecipientSha256, "RESTORE_RECIPIENT_MISMATCH");
  assert.equal(receipt.sourceContainerId, expectedSourceContainerId, "RESTORE_SOURCE_MISMATCH");
  assert.equal(receipt.atomicSnapshot, false);
  assert.equal(receipt.verifiedCurrentRollback, false);
  assert.equal(receipt.restoreVerified, false);
  assert.equal(receipt.independentRestore, "NOT_RUN");
  assert.equal(receipt.maxEncryptedBytes, MAX_ENCRYPTED_BYTES);
  assert.ok(Array.isArray(receipt.components) && receipt.components.length === 5,
    "RESTORE_COMPONENT_COUNT_INVALID");
  const observed = new Set();
  let total = 0;
  for (const component of receipt.components) {
    assert.ok(Date.now() < deadlineAt, "RESTORE_PREFLIGHT_DEADLINE");
    const expected = COMPONENT_FILES[component.id];
    assert.ok(expected && component.file === expected && basename(component.file) === component.file &&
      !observed.has(component.id) && component.status === "CAPTURED_NOT_RESTORED",
    "RESTORE_COMPONENT_INVALID");
    observed.add(component.id);
    const path = join(directory, expected);
    const before = privateRegular(path);
    assert.ok(Number.isSafeInteger(component.ciphertextBytes) && component.ciphertextBytes > ageHeader.length &&
      before.size === component.ciphertextBytes && SHA.test(component.ciphertextSha256),
    "RESTORE_CIPHERTEXT_SIZE_OR_DIGEST_INVALID");
    assert.ok(component.ciphertextBytes <= MAX_ENCRYPTED_BYTES - total,
      "RESTORE_CIPHERTEXT_CUMULATIVE_CAP");
    total += component.ciphertextBytes;
    assert.ok(availableBytes(directory) >= MIN_INTERNAL_FREE_BYTES + MAX_ENCRYPTED_BYTES,
      "RESTORE_INTERNAL_FREE_FLOOR");
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = fstatSync(fd);
      assert.equal(opened.ino, before.ino, "RESTORE_FILE_RACE");
      const header = Buffer.alloc(ageHeader.length);
      assert.equal(readSync(fd, header, 0, header.length, 0), header.length);
      assert.ok(header.equals(ageHeader), "RESTORE_NOT_AGE_FORMAT");
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path, { fd, autoClose: false })) {
        assert.ok(Date.now() < deadlineAt, "RESTORE_PREFLIGHT_DEADLINE");
        hash.update(chunk);
      }
      assert.equal(hash.digest("hex"), component.ciphertextSha256, "RESTORE_CIPHERTEXT_SHA_MISMATCH");
      const after = fstatSync(fd);
      assert.ok(after.ino === before.ino && after.size === before.size &&
        after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs,
      "RESTORE_CIPHERTEXT_CHANGED_DURING_READ");
    } finally { closeSync(fd); }
  }
  assert.equal(observed.size, Object.keys(COMPONENT_FILES).length);
  assert.equal(total, receipt.totalEncryptedBytes, "RESTORE_CIPHERTEXT_TOTAL_MISMATCH");
  return { status: "CIPHERTEXT_SET_VERIFIED_NOT_DECRYPTED", bytes: total,
    components: [...observed].sort(), receipt };
}

// Synthetic orchestration only: the adapter is a test double, not a route to
// real data. Its proof is not accepted as live isolation evidence.
export async function runSyntheticRestoreContract({ receiptPath, expected, target, forbiddenRoots,
  adapter, proof, availableBytes, deadlineAt = Date.now() + 180_000 }) {
  let lock;
  try {
    if (Date.now() >= deadlineAt) throw new Error("RESTORE_DEADLINE");
    assertDisjointTarget(target, forbiddenRoots);
    assertFreshIsolatedTarget(proof);
    lock = acquireCaptureLock(join(target, ".synthetic-restore.lock"));
    const checked = await verifyComponentCiphertexts(receiptPath, {
      ...expected, deadlineAt, availableBytes,
    });
    await adapter.decryptAndAuthenticate(checked);
    await adapter.verifyStorageTarBeforeExtraction(checked);
    await adapter.restoreGlobals();
    for (const id of Object.keys(COMPONENT_FILES).filter(id => id.startsWith("database:")))
      await adapter.restoreFreshDatabase(id);
    await adapter.verifyAuthRolesRlsSchemaMigrations();
    await adapter.verifyStorageMetadataAndBytes();
    return { status: "SYNTHETIC_COMPONENT_RESTORE_CONTRACT_PASS",
      independentRestore: "NOT_RUN_ON_REAL_DATA", atomicSnapshot: false };
  } catch (error) {
    return { status: "BLOCKED", reason: /^[A-Z][A-Z0-9_]{4,100}$/.test(String(error?.message))
      ? error.message : "RESTORE_CONTRACT_FAILED", independentRestore: "NOT_RUN_ON_REAL_DATA" };
  } finally {
    try { await adapter.cleanup(); } finally { lock?.release(); }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stderr.write("REAL_RESTORE_ADAPTER_NOT_IMPLEMENTED\n");
  process.exitCode = 2;
}
