import assert from "node:assert/strict";
import { closeSync, fstatSync, lstatSync, openSync, unlinkSync } from "node:fs";

export const MAX_ENCRYPTED_BYTES = 1024 ** 3;
export const MIN_INTERNAL_FREE_BYTES = 3 * 1024 ** 3;

const sha256 = /^[a-f0-9]{64}$/;

export function removeOwnedNewFile(path, expectedInode) {
  assert.ok(Number.isSafeInteger(expectedInode) && expectedInode > 0,
    "NEW_CIPHERTEXT_INODE_REQUIRED");
  let current;
  try { current = lstatSync(path); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
  assert.ok(current.isFile() && current.ino === expectedInode, "CIPHERTEXT_OWNERSHIP_CHANGED");
  unlinkSync(path);
  return true;
}

export function acquireCaptureLock(path) {
  const fd = openSync(path, "wx", 0o600);
  let inode;
  try { inode = fstatSync(fd).ino; }
  catch (error) { closeSync(fd); throw error; }
  let released = false;
  return { release() {
    assert.equal(released, false, "CAPTURE_LOCK_ALREADY_RELEASED");
    closeSync(fd);
    released = true;
    removeOwnedNewFile(path, inode);
  } };
}

export function compareStorageObservations(before, after) {
  assert.ok(before && after, "STORAGE_OBSERVATION_MISSING");
  const exceptions = [];
  if (before.metadataDigest !== after.metadataDigest || before.metadataRows !== after.metadataRows)
    exceptions.push("STORAGE_METADATA_CHANGED");
  if (before.files.length !== after.files.length) exceptions.push("STORAGE_FILE_COUNT_CHANGED");
  if (before.totalBytes !== after.totalBytes) exceptions.push("STORAGE_FILE_BYTES_CHANGED");
  const first = new Map(before.files.map(file => [file.pathDigest, file]));
  const second = new Map(after.files.map(file => [file.pathDigest, file]));
  if (first.size !== before.files.length || second.size !== after.files.length)
    exceptions.push("STORAGE_FILE_IDENTITY_DUPLICATE");
  for (const [pathDigest, file] of first) {
    const candidate = second.get(pathDigest);
    if (!candidate) exceptions.push("STORAGE_FILE_MISSING_OR_RENAMED");
    else if (file.sha256 !== candidate.sha256 || file.bytes !== candidate.bytes)
      exceptions.push("STORAGE_FILE_CONTENT_CHANGED");
  }
  for (const pathDigest of second.keys()) if (!first.has(pathDigest)) exceptions.push("STORAGE_FILE_ADDED_OR_RENAMED");
  return [...new Set(exceptions)];
}

export function createComponentReceipt({ expectedDatabases, maxBytes = MAX_ENCRYPTED_BYTES }) {
  assert.ok(Array.isArray(expectedDatabases) && expectedDatabases.length > 0);
  assert.ok(Number.isSafeInteger(maxBytes) && maxBytes > 0);
  const expected = new Set(expectedDatabases.map(name => `database:${name}`));
  assert.equal(expected.size, expectedDatabases.length, "DUPLICATE_EXPECTED_DATABASE");
  expected.add("globals");
  expected.add("storage-bytes");
  const components = [];
  let totalEncryptedBytes = 0;
  function addSuccess({ kind, name, file, startedAtUtc, endedAtUtc, bytes, ciphertextSha256, details = {} }) {
    const id = kind === "database" ? `database:${name}` : kind;
    assert.ok(expected.has(id), "UNEXPECTED_COMPONENT");
    assert.ok(!components.some(item => item.id === id), "DUPLICATE_COMPONENT");
    assert.ok(Number.isSafeInteger(bytes) && bytes > 0 && bytes <= maxBytes - totalEncryptedBytes,
      "CUMULATIVE_CIPHERTEXT_CAP_EXCEEDED");
    assert.match(ciphertextSha256, sha256);
    assert.ok(Date.parse(startedAtUtc) <= Date.parse(endedAtUtc), "INVALID_CAPTURE_INTERVAL");
    totalEncryptedBytes += bytes;
    components.push({ id, kind, name: name ?? null, file, status: "CAPTURED_NOT_RESTORED",
      startedAtUtc, endedAtUtc, ciphertextBytes: bytes, ciphertextSha256, details });
  }
  function addFailure({ kind, name, reason, startedAtUtc, endedAtUtc }) {
    const id = kind === "database" ? `database:${name}` : kind;
    assert.ok(expected.has(id), "UNEXPECTED_COMPONENT");
    assert.ok(!components.some(item => item.id === id), "DUPLICATE_COMPONENT");
    components.push({ id, kind, name: name ?? null, status: "BLOCKED", reason,
      startedAtUtc, endedAtUtc });
  }
  return {
    get remainingBytes() { return maxBytes - totalEncryptedBytes; },
    get totalEncryptedBytes() { return totalEncryptedBytes; },
    addSuccess, addFailure,
    receipt(extra = {}) {
      const complete = components.length === expected.size &&
        components.every(item => item.status === "CAPTURED_NOT_RESTORED");
      return { ...extra, status: complete ? "COMPONENT_BACKUPS_ONLY" : "BLOCKED",
        atomicSnapshot: false, verifiedCurrentRollback: false, restoreVerified: false,
        maxEncryptedBytes: maxBytes, totalEncryptedBytes, components: [...components] };
    },
  };
}
