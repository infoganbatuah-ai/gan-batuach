import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { verifyDecryptedStorageTar } from "./verify-decrypted-storage-tar.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const octal = (header, offset, length, value) =>
  header.write(value.toString(8).padStart(length - 1, "0") + "\0", offset, length, "ascii");
function record(name, data = "", type = "0") {
  const body = Buffer.from(data);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  octal(header, 100, 8, 0o600);
  octal(header, 108, 8, 0);
  octal(header, 116, 8, 0);
  octal(header, 124, 12, body.length);
  octal(header, 136, 12, 0);
  header.fill(32, 148, 156);
  header.write(type, 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  octal(header, 148, 8, header.reduce((sum, byte) => sum + byte, 0));
  return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)]);
}
const end = () => Buffer.alloc(1024);
const tar = (...entries) => Buffer.concat([...entries, end()]);
function receipt(files) {
  const manifest = files.map(([name, content]) => ({
    pathDigest: hash(name), bytes: Buffer.byteLength(content), sha256: hash(content),
  })).sort((a, b) => a.pathDigest.localeCompare(b.pathDigest));
  return { atomicSnapshot: false, verifiedCurrentRollback: false,
    components: [{ id: "storage-bytes", status: "CAPTURED_NOT_RESTORED",
      details: { sampledSourceFileManifest: manifest, fileCount: manifest.length,
        logicalFileBytes: manifest.reduce((n, file) => n + file.bytes, 0),
        crossStoreAtomicity: "NOT_PROVEN" } }] };
}
const example = receipt([["a", "abc"], ["folder/b", "xyz"]]);
async function check(bytes, manifest = example, options) {
  return verifyDecryptedStorageTar(Readable.from([bytes.subarray(0, 17), bytes.subarray(17, 521),
    bytes.subarray(521)]), manifest, options);
}
const clean = () => tar(record("./", "", "5"), record("./a", "abc"),
  record("./folder/", "", "5"), record("./folder/b", "xyz"));
const error = (promise, code) => assert.rejects(promise, { message: code });

test("verified files match opaque O_NOATIME manifest; order is immaterial", async () => {
  const result = await check(clean());
  assert.equal(result.fileCount, 2);
  assert.equal(result.logicalBytes, 6);
  assert.equal(result.metadataObjectMapping, "NOT_PROVEN");
  assert.equal(result.crossStoreAtomicity, "NOT_PROVEN");
  assert.deepEqual(Object.keys(result).sort(), ["crossStoreAtomicity", "currentRollback",
    "fileCount", "logicalBytes", "manifestSha256", "metadataObjectMapping", "status"]);
  const reordered = await check(tar(record("./folder/b", "xyz"), record("./a", "abc")));
  assert.equal(result.manifestSha256, reordered.manifestSha256);
});
test("observed BusyBox GNU-compatible ustar marker is accepted", async () => {
  const bytes = tar(record("a", "abc"));
  bytes.write("ustar  \0", 257, 8, "ascii");
  bytes.fill(32, 148, 156);
  octal(bytes, 148, 8, bytes.subarray(0, 512).reduce((sum, byte) => sum + byte, 0));
  const result = await check(bytes, receipt([["a", "abc"]]));
  assert.equal(result.status, "STORAGE_ARCHIVE_FILES_VERIFIED");
});
test("content mismatch", () => error(check(tar(record("a", "abd"), record("folder/b", "xyz"))), "TAR_FILE_HASH_MISMATCH"));
test("size mismatch", () => error(check(tar(record("a", "ab"), record("folder/b", "xyz"))), "TAR_FILE_SIZE_MISMATCH"));
test("missing file", () => error(check(tar(record("a", "abc"))), "TAR_MISSING_FILE"));
test("extra file", () => error(check(tar(record("a", "abc"), record("folder/b", "xyz"), record("extra", "1"))), "TAR_UNEXPECTED_FILE"));
test("duplicate file", () => error(check(tar(record("a", "abc"), record("a", "abc"))), "TAR_DUPLICATE_ENTRY"));
test("duplicate directory and file collision", () => error(check(tar(record("./a/", "", "5"), record("./a", "abc"))), "TAR_DUPLICATE_ENTRY"));
test("traversal and absolute paths", async () => {
  for (const name of ["../a", "/a", "./../a", "a/../../b", "a//b", "a\\b", "a/"])
    await error(check(tar(record(name, "abc"))), "TAR_PATH_INVALID");
});
test("links, devices, FIFO and PAX are refused", async () => {
  for (const type of ["1", "2", "3", "4", "6", "x", "L"])
    await error(check(tar(record("a", "", type))), "TAR_ENTRY_TYPE_FORBIDDEN");
});
test("header checksum corruption", () => {
  const bytes = clean(); bytes[100] ^= 1;
  return error(check(bytes), "TAR_HEADER_CHECKSUM_INVALID");
});
test("malformed size field is refused even with a valid checksum", () => {
  const bytes = tar(record("a", "abc"));
  bytes[124] = "9".charCodeAt(0);
  bytes.fill(32, 148, 156);
  octal(bytes, 148, 8, bytes.subarray(0, 512).reduce((sum, byte) => sum + byte, 0));
  return error(check(bytes, receipt([["a", "abc"]])), "TAR_HEADER_INVALID");
});
test("body padding corruption", () => {
  const bytes = tar(record("a", "abc")); bytes[512 + 3] = 1;
  return error(check(bytes, receipt([["a", "abc"]])), "TAR_PADDING_INVALID");
});
test("missing, truncated and malformed tar terminators", async () => {
  await error(check(clean().subarray(0, -512)), "TAR_TRUNCATED_OR_UNTERMINATED");
  await error(check(clean().subarray(0, -1)), "TAR_TRUNCATED_OR_UNTERMINATED");
  const bytes = clean(); bytes[bytes.length - 1] = 1;
  await error(check(bytes), "TAR_END_MARKER_INVALID");
});
test("truncated body and synthetic trailing entry", async () => {
  const body = record("a", "abc");
  await error(check(body.subarray(0, 513), receipt([["a", "abc"]])), "TAR_TRUNCATED_OR_UNTERMINATED");
  await error(check(Buffer.concat([clean(), record("new", "x")]), example), "TAR_END_MARKER_INVALID");
});
test("byte cap and manifest cap fail closed", async () => {
  await error(check(clean(), example, { maxTarBytes: 1024 }), "TAR_BYTE_CAP");
  const invalid = receipt([["a", "abc"]]);
  invalid.components[0].details.logicalFileBytes = 1;
  await error(check(clean(), invalid), "STORAGE_MANIFEST_INVALID");
});
test("abort signal stops verification", async () => {
  const controller = new AbortController(); controller.abort();
  await error(check(clean(), example, { signal: controller.signal }), "TAR_VERIFICATION_ABORTED");
});
test("receipt cannot assert atomic rollback or duplicate entries", async () => {
  const invalid = structuredClone(example); invalid.atomicSnapshot = true;
  await error(check(clean(), invalid), "STORAGE_RECEIPT_INVALID");
  const duplicate = structuredClone(example);
  duplicate.components[0].details.sampledSourceFileManifest[1].pathDigest =
    duplicate.components[0].details.sampledSourceFileManifest[0].pathDigest;
  await error(check(clean(), duplicate), "STORAGE_MANIFEST_INVALID");
});
test("future restore CLI accepts synthetic tar and emits no object names", () => {
  const directory = mkdtempSync(join(tmpdir(), "do-storage-archive-gate-test."));
  try {
    const path = join(directory, "receipt.json");
    writeFileSync(path, JSON.stringify(example), { mode: 0o600 });
    const result = spawnSync(process.execPath, [join(import.meta.dirname,
      "storage-restore-archive-gate.mjs"), "--receipt", path], { input: clean(), encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).fileCount, 2);
    assert.ok(!result.stdout.includes("folder/b") && !result.stdout.includes("abc"));
    assert.equal(result.stderr, "");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
