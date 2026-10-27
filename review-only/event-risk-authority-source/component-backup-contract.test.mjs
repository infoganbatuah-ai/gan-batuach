import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acquireCaptureLock, compareStorageObservations, createComponentReceipt, removeOwnedNewFile } from "./component-backup-contract.mjs";

const hash = text => createHash("sha256").update(text).digest("hex");
const times = { startedAtUtc: "2026-10-28T00:00:00.000Z", endedAtUtc: "2026-10-28T00:00:01.000Z" };
const sample = (kind, name, bytes = 1) => ({ kind, name, file: `${name ?? kind}.age`, bytes,
  ciphertextSha256: hash(`${kind}:${name}`), ...times });
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "do-storage-inventory-test."));
  t.after(() => { assert.ok(root.startsWith(join(tmpdir(), "do-storage-inventory-test.")));
    rmSync(root, { recursive: true }); });
  return root;
}
function inventory(root) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, "storage-file-inventory.mjs")],
    { env: { ...process.env, DO_STORAGE_ROOT: root }, encoding: "utf8" });
  return result;
}

test("distinct component receipts never claim an atomic snapshot or restore PASS", () => {
  const ledger = createComponentReceipt({ expectedDatabases: ["postgres", "other"], maxBytes: 12 });
  ledger.addSuccess(sample("database", "postgres", 3));
  ledger.addSuccess(sample("database", "other", 3));
  ledger.addSuccess(sample("globals", null, 2));
  ledger.addSuccess(sample("storage-bytes", null, 4));
  const result = ledger.receipt({ status: "ATOMIC_SNAPSHOT", atomicSnapshot: true,
    verifiedCurrentRollback: true, restoreVerified: true });
  assert.equal(result.status, "COMPONENT_BACKUPS_ONLY");
  assert.equal(result.atomicSnapshot, false);
  assert.equal(result.verifiedCurrentRollback, false);
  assert.equal(result.restoreVerified, false);
  assert.equal(result.totalEncryptedBytes, 12);
  assert.equal(ledger.remainingBytes, 0);
});

test("cumulative ceiling blocks a later component without counting or accepting it", () => {
  const ledger = createComponentReceipt({ expectedDatabases: ["postgres"], maxBytes: 10 });
  ledger.addSuccess(sample("database", "postgres", 8));
  assert.equal(ledger.remainingBytes, 2);
  assert.throws(() => ledger.addSuccess(sample("globals", null, 3)), /CUMULATIVE_CIPHERTEXT_CAP_EXCEEDED/);
  assert.equal(ledger.totalEncryptedBytes, 8);
  assert.equal(ledger.receipt().status, "BLOCKED");
});

test("failure between components preserves completed component evidence but blocks the set", () => {
  const ledger = createComponentReceipt({ expectedDatabases: ["postgres"], maxBytes: 10 });
  ledger.addSuccess(sample("database", "postgres", 4));
  ledger.addFailure({ kind: "globals", reason: "AGE_ENCRYPTION_FAILED", ...times });
  assert.equal(ledger.receipt().status, "BLOCKED");
  assert.deepEqual(ledger.receipt().components.map(item => item.status),
    ["CAPTURED_NOT_RESTORED", "BLOCKED"]);
  assert.equal(ledger.totalEncryptedBytes, 4);
});

test("duplicate or unexpected component and invalid capture interval fail closed", () => {
  const ledger = createComponentReceipt({ expectedDatabases: ["postgres"] });
  ledger.addSuccess(sample("database", "postgres"));
  assert.throws(() => ledger.addSuccess(sample("database", "postgres")), /DUPLICATE_COMPONENT/);
  assert.throws(() => ledger.addSuccess(sample("database", "production")), /UNEXPECTED_COMPONENT/);
  assert.throws(() => ledger.addSuccess({ ...sample("globals", null), endedAtUtc: "2020-01-01T00:00:00Z" }),
    /INVALID_CAPTURE_INTERVAL/);
});

const observation = { metadataDigest: hash("row"), metadataRows: 1, totalBytes: 4,
  files: [{ pathDigest: hash("object-path"), sha256: hash("data"), bytes: 4 }] };

test("Storage source mutation, disappearance, addition and metadata change invalidate the component", () => {
  assert.deepEqual(compareStorageObservations(observation, structuredClone(observation)), []);
  assert.ok(compareStorageObservations(observation, { ...observation, metadataDigest: hash("other") })
    .includes("STORAGE_METADATA_CHANGED"));
  assert.ok(compareStorageObservations(observation, { ...observation, files: [] })
    .includes("STORAGE_FILE_MISSING_OR_RENAMED"));
  assert.ok(compareStorageObservations(observation, { ...observation,
    files: [{ ...observation.files[0], sha256: hash("changed") }] })
    .includes("STORAGE_FILE_CONTENT_CHANGED"));
  assert.ok(compareStorageObservations(observation, { ...observation,
    files: [...observation.files, { pathDigest: hash("new"), sha256: hash("new"), bytes: 0 }] })
    .includes("STORAGE_FILE_ADDED_OR_RENAMED"));
});

test("fixture inventory records opaque per-file hashes and logical bytes, never names or contents", t => {
  const root = fixture(t);
  mkdirSync(join(root, "bucket"));
  writeFileSync(join(root, "bucket", "private-name"), "data");
  const result = inventory(root);
  assert.equal(result.status, 0);
  assert.ok(!result.stdout.includes("private-name"));
  assert.ok(!result.stdout.includes("bucket"));
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.totalBytes, 4);
  assert.deepEqual(parsed.files, [{ pathDigest: hash("bucket/private-name"), bytes: 4,
    sha256: hash("data") }]);
});

test("fixture inventory refuses symlinks and does not expose their target", t => {
  const root = fixture(t);
  symlinkSync("/private/sensitive-path", join(root, "link"));
  const result = inventory(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STORAGE_NONREGULAR_ENTRY/);
  assert.ok(!result.stderr.includes("sensitive-path"));
});

test("invalidated Storage removes only the exact new inode, never a prior or replaced archive", t => {
  const root = fixture(t);
  const prior = join(root, "prior.age");
  const current = join(root, "current.age");
  writeFileSync(prior, "existing");
  writeFileSync(current, "new");
  const originalInode = statSync(current).ino;
  assert.throws(() => removeOwnedNewFile(current, statSync(prior).ino), /CIPHERTEXT_OWNERSHIP_CHANGED/);
  assert.equal(readFileSync(current, "utf8"), "new");
  assert.equal(removeOwnedNewFile(current, originalInode), true);
  assert.equal(existsSync(current), false);
  assert.equal(readFileSync(prior, "utf8"), "existing");
});

test("exclusive run lock blocks concurrent capture and removes only its own lock", t => {
  const root = fixture(t);
  const path = join(root, ".component-capture.lock");
  const lock = acquireCaptureLock(path);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.throws(() => acquireCaptureLock(path), /EEXIST/);
  lock.release();
  assert.equal(existsSync(path), false);
  assert.throws(() => lock.release(), /CAPTURE_LOCK_ALREADY_RELEASED/);
});

test("capture CLI without explicit component-only flag is blocked before source access", () => {
  const result = spawnSync(process.execPath,
    [join(import.meta.dirname, "capture-current-development-encrypted.mjs")],
    { encoding: "utf8", timeout: 5_000 });
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "BLOCKED");
  assert.equal(output.reason, "EXPLICIT_COMPONENT_ONLY_MODE_REQUIRED");
  assert.equal(output.backupDirectory, null);
});
