// Review-only restore gate. Feed a decrypted tar stream from an isolated fixture
// or, after separate approval, a protected restore process. Never extracts files.
import { createHash } from "node:crypto";

const BLOCK = 512;
const HEX = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAX_FILES = 20_000;
const MAX_LOGICAL_BYTES = 1024 ** 3;
const MAX_TAR_BYTES = MAX_LOGICAL_BYTES + (MAX_FILES + 4) * 1024;

function fail(code) { throw new Error(code); }
function digest(value) { return createHash("sha256").update(value).digest("hex"); }
function decodeField(bytes) {
  const end = bytes.indexOf(0);
  const value = bytes.subarray(0, end < 0 ? bytes.length : end);
  if (end >= 0 && bytes.subarray(end).some(byte => byte !== 0)) fail("TAR_HEADER_INVALID");
  try { return decoder.decode(value); } catch { fail("TAR_PATH_INVALID"); }
}
function octal(bytes) {
  if (bytes[0] & 0x80) fail("TAR_HEADER_INVALID");
  const field = Buffer.from(bytes).toString("ascii");
  if (!/^ *[0-7]+ *\0* *$/.test(field)) fail("TAR_HEADER_INVALID");
  const value = field.replace(/\0.*$/s, "").trim();
  if (!/^[0-7]+$/.test(value)) fail("TAR_HEADER_INVALID");
  const result = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(result)) fail("TAR_HEADER_INVALID");
  return result;
}
function entryName(header) {
  const name = decodeField(header.subarray(0, 100));
  const prefix = decodeField(header.subarray(345, 500));
  if (!name) fail("TAR_PATH_INVALID");
  const raw = prefix ? `${prefix}/${name}` : name;
  const relative = raw.startsWith("./") ? raw.slice(2) : raw;
  if (relative === "." || relative === "") return { relative: "", root: true, trailingSlash: true };
  const normalized = relative.endsWith("/") ? relative.slice(0, -1) : relative;
  if (raw.startsWith("/") || normalized.startsWith("/") || normalized.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(normalized) ||
      normalized.split("/").some(part => !part || part === "." || part === ".."))
    fail("TAR_PATH_INVALID");
  return { relative: normalized, root: false, trailingSlash: relative.endsWith("/") };
}
function parseHeader(header) {
  const format = header.subarray(257, 265);
  if (!format.equals(Buffer.from("ustar\0" + "00")) &&
      !format.equals(Buffer.from("ustar  \0"))) fail("TAR_FORMAT_UNSUPPORTED");
  const stored = octal(header.subarray(148, 156));
  let calculated = 0;
  for (let i = 0; i < BLOCK; i++) calculated += i >= 148 && i < 156 ? 32 : header[i];
  if (stored !== calculated) fail("TAR_HEADER_CHECKSUM_INVALID");
  const type = header[156];
  if (type !== 0 && type !== 48 && type !== 53) fail("TAR_ENTRY_TYPE_FORBIDDEN");
  if (header.subarray(157, 257).some(byte => byte !== 0)) fail("TAR_LINK_FORBIDDEN");
  const size = octal(header.subarray(124, 136));
  if (type === 53 && size !== 0) fail("TAR_DIRECTORY_INVALID");
  const { relative, root, trailingSlash } = entryName(header);
  if (root && type !== 53) fail("TAR_PATH_INVALID");
  if (type !== 53 && trailingSlash) fail("TAR_PATH_INVALID");
  return { relative, root, directory: type === 53, size };
}

export function expectedStorageManifest(receipt) {
  const components = receipt?.components;
  if (!Array.isArray(components)) fail("STORAGE_RECEIPT_INVALID");
  const matches = components.filter(item => item.id === "storage-bytes");
  if (matches.length !== 1 || matches[0].status !== "CAPTURED_NOT_RESTORED" ||
      receipt.atomicSnapshot !== false || receipt.verifiedCurrentRollback !== false ||
      matches[0].details?.crossStoreAtomicity !== "NOT_PROVEN") fail("STORAGE_RECEIPT_INVALID");
  const details = matches[0].details;
  const files = details.sampledSourceFileManifest;
  if (!Array.isArray(files) || files.length !== details.fileCount || files.length > MAX_FILES ||
      !Number.isSafeInteger(details.logicalFileBytes) || details.logicalFileBytes < 0 ||
      details.logicalFileBytes > MAX_LOGICAL_BYTES) fail("STORAGE_MANIFEST_INVALID");
  const expected = new Map();
  let total = 0;
  for (const file of files) {
    if (typeof file?.pathDigest !== "string" || !HEX.test(file.pathDigest) ||
        typeof file.sha256 !== "string" || !HEX.test(file.sha256) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 0 ||
        expected.has(file.pathDigest)) fail("STORAGE_MANIFEST_INVALID");
    total += file.bytes;
    expected.set(file.pathDigest, { bytes: file.bytes, sha256: file.sha256 });
  }
  if (total !== details.logicalFileBytes) fail("STORAGE_MANIFEST_INVALID");
  return { expected, count: files.length, logicalBytes: total };
}

export async function verifyDecryptedStorageTar(stream, receipt, { signal, maxTarBytes = MAX_TAR_BYTES } = {}) {
  if (!stream || typeof stream.destroy !== "function" ||
      typeof stream[Symbol.asyncIterator] !== "function") fail("TAR_STREAM_INVALID");
  if (!Number.isSafeInteger(maxTarBytes) || maxTarBytes < 1024 || maxTarBytes > MAX_TAR_BYTES)
    fail("TAR_LIMIT_INVALID");
  const { expected, count, logicalBytes } = expectedStorageManifest(receipt);
  const observed = new Set();
  const paths = new Set();
  let phase = "header";
  let block = Buffer.alloc(BLOCK);
  let used = 0;
  let zeroHeaders = 0;
  let tarBytes = 0;
  let fileBytes = 0;
  let fileHash = null;
  let currentDigest = null;
  let currentExpected = null;
  let remaining = 0;
  let padding = 0;
  let entries = 0;
  let rootSeen = false;
  function assertNotAborted() { if (signal?.aborted) fail("TAR_VERIFICATION_ABORTED"); }
  const onAbort = () => stream.destroy?.(new Error("TAR_VERIFICATION_ABORTED"));
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for await (const chunk of stream) {
      assertNotAborted();
      if (!Buffer.isBuffer(chunk)) fail("TAR_STREAM_INVALID");
      tarBytes += chunk.length;
      if (tarBytes > maxTarBytes) fail("TAR_BYTE_CAP");
      let offset = 0;
      while (offset < chunk.length) {
        assertNotAborted();
        if (phase === "body") {
          const take = Math.min(remaining, chunk.length - offset);
          fileHash.update(chunk.subarray(offset, offset + take));
          remaining -= take;
          offset += take;
          if (remaining === 0) {
            if (fileHash.digest("hex") !== currentExpected.sha256) fail("TAR_FILE_HASH_MISMATCH");
            observed.add(currentDigest);
            phase = padding ? "padding" : "header";
          }
          continue;
        }
        if (phase === "padding") {
          const take = Math.min(padding, chunk.length - offset);
          if (chunk.subarray(offset, offset + take).some(byte => byte !== 0)) fail("TAR_PADDING_INVALID");
          padding -= take;
          offset += take;
          if (padding === 0) phase = "header";
          continue;
        }
        const take = Math.min(BLOCK - used, chunk.length - offset);
        chunk.copy(block, used, offset, offset + take);
        used += take;
        offset += take;
        if (used !== BLOCK) continue;
        used = 0;
        if (block.every(byte => byte === 0)) { zeroHeaders++; continue; }
        if (zeroHeaders > 0) fail("TAR_END_MARKER_INVALID");
        const entry = parseHeader(block);
        entries++;
        if (entries > MAX_FILES * 8 + 1) fail("TAR_ENTRY_COUNT_CAP");
        if (entry.root) {
          if (rootSeen) fail("TAR_DUPLICATE_ENTRY");
          rootSeen = true;
        } else {
          const pathKey = digest(encoder.encode(entry.relative));
          if (paths.has(pathKey)) fail("TAR_DUPLICATE_ENTRY");
          paths.add(pathKey);
        }
        if (entry.directory) continue;
        currentDigest = digest(encoder.encode(entry.relative));
        if (observed.has(currentDigest)) fail("TAR_DUPLICATE_ENTRY");
        currentExpected = expected.get(currentDigest);
        if (!currentExpected) fail("TAR_UNEXPECTED_FILE");
        if (entry.size !== currentExpected.bytes) fail("TAR_FILE_SIZE_MISMATCH");
        if (entry.size > MAX_LOGICAL_BYTES - fileBytes) fail("TAR_LOGICAL_BYTE_CAP");
        fileBytes += entry.size;
        remaining = entry.size;
        padding = (BLOCK - (entry.size % BLOCK)) % BLOCK;
        fileHash = createHash("sha256");
        if (remaining) phase = "body";
        else {
          if (fileHash.digest("hex") !== currentExpected.sha256) fail("TAR_FILE_HASH_MISMATCH");
          observed.add(currentDigest);
          phase = padding ? "padding" : "header";
        }
      }
    }
    assertNotAborted();
    if (phase !== "header" || used !== 0 || zeroHeaders < 2 || tarBytes % BLOCK !== 0)
      fail("TAR_TRUNCATED_OR_UNTERMINATED");
    if (observed.size !== count || fileBytes !== logicalBytes) fail("TAR_MISSING_FILE");
    const manifestSha256 = digest([...expected.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([pathDigest, file]) => `${pathDigest}:${file.bytes}:${file.sha256}\n`).join(""));
    return { status: "STORAGE_ARCHIVE_FILES_VERIFIED", fileCount: count,
      logicalBytes, manifestSha256, metadataObjectMapping: "NOT_PROVEN",
      crossStoreAtomicity: "NOT_PROVEN", currentRollback: "NOT_PROVEN" };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (phase !== "header" || used !== 0 || zeroHeaders < 2 || observed.size !== count)
      stream.destroy?.();
  }
}
