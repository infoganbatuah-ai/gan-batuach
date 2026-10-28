// Local QA image input only. This module never invokes Docker or a provider.
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { constants, closeSync, createReadStream, fstatSync, lstatSync, openSync,
  readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import * as tar from "tar";

export const QA_POSTGRES_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.167";
export const QA_POSTGRES_IMAGE_ID =
  "sha256:ed2c675a446d78a346e88f18afb6ae0cf46f64251f8c9186446bdf1526dd3655";
export const MAX_QA_IMAGE_TAR_BYTES = 2 * 1024 ** 3;
export const MAX_QA_BASE_IMAGE_BYTES = 2 * 1024 ** 3;
// No independently verified QA attestor is pinned yet. Deliberate hard NO-GO.
// A future reviewed change must pin the owner-approved public key and its SPKI digest.
export const APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM = null;
export const APPROVED_QA_ATTESTOR_SPKI_SHA256 = null;
const SOURCE_ROOT = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach";
const PROJECT_ROOT = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach";
const HEX64 = /^[a-f0-9]{64}$/;

function within(path, root) { return path === root || path.startsWith(root + sep); }
function assertOutsideOriginal(path, code) {
  assert.ok(!within(path, SOURCE_ROOT) && !within(path, PROJECT_ROOT), code);
}

// On macOS a File Provider placeholder can advertise the expected logical
// length while allocating zero blocks. Opening it can trigger a network fetch.
// These QA inputs must already be local; reject sparse/dataless candidates.
export function assertQaImageLocallyResident(stat) {
  assert.ok(Number.isSafeInteger(stat?.size) && stat.size > 0 &&
    Number.isSafeInteger(stat?.blocks) && stat.blocks > 0,
  "QA_IMAGE_NOT_LOCALLY_RESIDENT_NO_HYDRATION");
}

export function assertQaImageNotDatalessFlags(flags) {
  assert.ok(typeof flags === "string" &&
    !flags.trim().split(",").includes("dataless"),
  "QA_IMAGE_NOT_LOCALLY_RESIDENT_NO_HYDRATION");
}

function assertNoMacDatalessFlag(path) {
  // Node's Stats omits macOS st_flags. The system stat command reads metadata
  // only; even a partly hydrated File Provider file must never be opened here.
  const flags = execFileSync("/usr/bin/stat", ["-f", "%Sf", path],
    { encoding: "utf8", timeout: 3000 }).trim();
  assertQaImageNotDatalessFlags(flags);
}

export function assertQaImageTransferBoundary(proof) {
  for (const field of ["encrypted", "noHostMounts", "noProxyEnv",
    "guestIpv4OutputDrop", "guestIpv6OutputDrop", "guestIpv4ForwardDrop",
    "guestIpv6ForwardDrop", "ipv4EgressProbeDenied", "ipv6EgressProbeDenied",
    "dnsResolutionProbeDenied", "dnsHasNoAllowRule"]) {
    assert.equal(proof?.[field], true, `QA_IMAGE_${field.toUpperCase()}_UNPROVEN`);
  }
}

export function assertQaImageTargetCapacity(freeBytes, baseBytes, postgresBytes) {
  assert.ok(Number.isSafeInteger(freeBytes) && Number.isSafeInteger(baseBytes) &&
    Number.isSafeInteger(postgresBytes) && baseBytes > 0 &&
    baseBytes <= MAX_QA_BASE_IMAGE_BYTES && postgresBytes > 0 &&
    postgresBytes <= MAX_QA_IMAGE_TAR_BYTES &&
    freeBytes >= baseBytes + 2 * postgresBytes + 7 * 1024 ** 3,
  "QA_IMAGE_TARGET_CAPACITY_UNPROVEN");
}

export function parseQaImageArguments(args) {
  assert.ok(Array.isArray(args) && args.length === 12, "QA_IMAGE_ARGUMENTS_REQUIRED");
  const expected = ["--qa-base-image", "--qa-base-sha256", "--qa-image-tar",
    "--qa-image-sha256", "--qa-attestation-payload", "--qa-attestation-signature"];
  for (let index = 0; index < expected.length; index++)
    assert.equal(args[index * 2], expected[index], "QA_IMAGE_ARGUMENTS_INVALID");
  for (const index of [1, 5, 9, 11])
    assert.ok(typeof args[index] === "string" && isAbsolute(args[index]),
      "QA_IMAGE_PATH_NOT_ABSOLUTE");
  for (const index of [3, 7]) assert.match(args[index], HEX64, "QA_IMAGE_DIGEST_REQUIRED");
  return { base: { path: args[1], sha256: args[3] },
    postgres: { tarPath: args[5], sha256: args[7] },
    attestation: { payloadPath: args[9], signaturePath: args[11] } };
}

async function verifyArtifact({ path, sha256, maxBytes, kind }) {
  assert.ok(typeof path === "string" && isAbsolute(path), "QA_IMAGE_PATH_NOT_ABSOLUTE");
  assert.match(sha256, HEX64, "QA_IMAGE_DIGEST_REQUIRED");
  assertOutsideOriginal(resolve(path), "QA_IMAGE_SOURCE_NOT_INDEPENDENT");
  const absolute = join(realpathSync(dirname(path)), basename(path));
  const actual = realpathSync(path);
  assert.equal(actual, absolute, "QA_IMAGE_SYMLINK_DENIED");
  assertOutsideOriginal(actual, "QA_IMAGE_SOURCE_NOT_INDEPENDENT");
  const parent = lstatSync(dirname(actual));
  assert.ok(parent.isDirectory() && parent.uid === process.getuid() &&
    (parent.mode & 0o077) === 0, "QA_IMAGE_PARENT_NOT_PRIVATE");
  const before = lstatSync(actual);
  assert.ok(before.isFile() && before.nlink === 1 && before.uid === process.getuid() &&
    (before.mode & 0o077) === 0 && before.size > 0 &&
    before.size <= maxBytes, "QA_IMAGE_FILE_UNSAFE");
  assertQaImageLocallyResident(before);
  assertNoMacDatalessFlag(actual);
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
  return Object.freeze({ path: actual, sha256, bytes: before.size, kind });
}

export async function verifyIndependentQaImage({ tarPath, sha256 }) {
  const checked = await verifyArtifact({ path: tarPath, sha256,
    maxBytes: MAX_QA_IMAGE_TAR_BYTES, kind: "postgres-docker-save" });
  return Object.freeze({ ...checked, tarPath: checked.path,
    imageReference: QA_POSTGRES_IMAGE, imageId: QA_POSTGRES_IMAGE_ID,
    archiveIntegrity: "NOT_VERIFIED", provenance: "OWNER_ATTESTATION_REQUIRED" });
}

// Reads Docker-save entries without extraction, Docker, a guest, or a network.
// docker-save contains uncompressed layer.tar members: their SHA-256 values
// must match config.rootfs.diff_ids. The original OCI compressed blobs are
// not present here, so their registry digests cannot be rechecked from this tar.
export async function inspectQaDockerSaveArchive(tarPath,
  expectedImageId = QA_POSTGRES_IMAGE_ID) {
  assert.match(expectedImageId, /^sha256:[a-f0-9]{64}$/, "QA_IMAGE_ID_INVALID");
  const entries = new Map();
  const pending = [];
  let invalidEntry = false;
  await tar.t({ file: tarPath, strict: true, noResume: true,
    onReadEntry(entry) {
      const path = entry.path;
      const valid = entry.type === "File" &&
        (path === "manifest.json" || path === "supabase-postgres-arm64-config.json" ||
          /^layers\/(0[0-9]|1[0-9]|2[0-8])\/layer\.tar$/.test(path)) &&
        !entries.has(path) && Number.isSafeInteger(entry.size) && entry.size > 0;
      if (!valid) {
        invalidEntry = true;
        entry.resume();
        return;
      }
      const meta = path === "manifest.json" || path === "supabase-postgres-arm64-config.json";
      if (meta && entry.size > 64 * 1024) {
        invalidEntry = true;
        entry.resume();
        return;
      }
      const hash = createHash("sha256");
      const buffers = [];
      let bytes = 0;
      const complete = new Promise((accept, reject) => {
        entry.on("data", chunk => {
          bytes += chunk.length;
          hash.update(chunk);
          if (meta) buffers.push(chunk);
        });
        entry.on("end", () => {
          try {
            assert.equal(bytes, entry.size, "QA_DOCKER_SAVE_ENTRY_TRUNCATED");
            entries.set(path, { bytes, sha256: hash.digest("hex"),
              content: meta ? Buffer.concat(buffers) : null });
            accept();
          } catch (error) { reject(error); }
        });
        entry.on("error", reject);
      });
      pending.push(complete);
      entry.resume();
    }
  });
  await Promise.all(pending);
  assert.equal(invalidEntry, false, "QA_DOCKER_SAVE_ENTRY_INVALID");
  assert.equal(entries.size, 31, "QA_DOCKER_SAVE_ENTRY_COUNT_INVALID");
  const manifest = JSON.parse(entries.get("manifest.json")?.content?.toString("utf8") ?? "null");
  assert.ok(Array.isArray(manifest) && manifest.length === 1,
    "QA_DOCKER_SAVE_MANIFEST_INVALID");
  const image = manifest[0];
  const configPath = "supabase-postgres-arm64-config.json";
  assert.equal(image.Config, configPath, "QA_DOCKER_SAVE_CONFIG_INVALID");
  assert.deepEqual(image.RepoTags, [QA_POSTGRES_IMAGE], "QA_DOCKER_SAVE_TAG_INVALID");
  assert.ok(Array.isArray(image.Layers) && image.Layers.length === 29,
    "QA_DOCKER_SAVE_LAYER_COUNT_INVALID");
  assert.equal(`sha256:${entries.get(configPath)?.sha256}`, expectedImageId,
    "QA_DOCKER_SAVE_IMAGE_ID_MISMATCH");
  const config = JSON.parse(entries.get(configPath).content.toString("utf8"));
  assert.equal(config.architecture, "arm64", "QA_DOCKER_SAVE_ARCH_INVALID");
  assert.equal(config.os, "linux", "QA_DOCKER_SAVE_OS_INVALID");
  assert.equal(config.rootfs?.type, "layers", "QA_DOCKER_SAVE_ROOTFS_INVALID");
  assert.ok(Array.isArray(config.rootfs.diff_ids) && config.rootfs.diff_ids.length === 29,
    "QA_DOCKER_SAVE_DIFF_ID_COUNT_INVALID");
  for (let index = 0; index < 29; index++) {
    const path = `layers/${String(index).padStart(2, "0")}/layer.tar`;
    assert.equal(image.Layers[index], path, "QA_DOCKER_SAVE_LAYER_ORDER_INVALID");
    assert.equal(config.rootfs.diff_ids[index], `sha256:${entries.get(path)?.sha256}`,
      "QA_DOCKER_SAVE_LAYER_DIGEST_MISMATCH");
  }
  return Object.freeze({ imageId: expectedImageId, architecture: "arm64",
    layerCount: 29, layerDigestKind: "uncompressed-diff-id" });
}

export async function verifyPinnedQaDockerSave(checked) {
  const inspection = await inspectQaDockerSaveArchive(checked.tarPath);
  // Rehash after traversal to detect a swapped or changed input between the
  // initial private-file check and archive inspection.
  await verifyArtifact({ path: checked.tarPath, sha256: checked.sha256,
    maxBytes: MAX_QA_IMAGE_TAR_BYTES, kind: "postgres-docker-save" });
  return Object.freeze({ ...checked, ...inspection,
    archiveIntegrity: "STRUCTURE_AND_DIFF_IDS_VERIFIED" });
}

export async function verifyIndependentQaBaseImage({ path, sha256 }) {
  return verifyArtifact({ path, sha256, maxBytes: MAX_QA_BASE_IMAGE_BYTES,
    kind: "lima-base-aarch64" });
}

export function assertQaAttestorPinned(publicKeyPem = APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM,
  spkiSha256 = APPROVED_QA_ATTESTOR_SPKI_SHA256) {
  assert.ok(typeof publicKeyPem === "string" && publicKeyPem.length > 0 &&
    typeof spkiSha256 === "string" && HEX64.test(spkiSha256), "QA_ATTESTOR_NOT_PINNED");
  const key = createPublicKey(publicKeyPem);
  assert.equal(key.asymmetricKeyType, "ed25519", "QA_ATTESTOR_KEY_TYPE_INVALID");
  const actual = createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest("hex");
  assert.equal(actual, spkiSha256, "QA_ATTESTOR_KEY_PIN_MISMATCH");
  return key;
}

function readPrivateEvidence(path, maxBytes) {
  assert.ok(typeof path === "string" && isAbsolute(path), "QA_ATTESTATION_PATH_INVALID");
  assertOutsideOriginal(resolve(path), "QA_ATTESTATION_SOURCE_NOT_INDEPENDENT");
  const actual = realpathSync(path);
  assert.equal(actual, join(realpathSync(dirname(path)), basename(path)),
    "QA_ATTESTATION_SYMLINK_DENIED");
  assertOutsideOriginal(actual, "QA_ATTESTATION_SOURCE_NOT_INDEPENDENT");
  const parent = lstatSync(dirname(actual));
  const before = lstatSync(actual);
  assert.ok(parent.isDirectory() && parent.uid === process.getuid() &&
    (parent.mode & 0o077) === 0 && before.isFile() && before.nlink === 1 &&
    before.uid === process.getuid() && (before.mode & 0o077) === 0 &&
    before.size > 0 && before.size <= maxBytes, "QA_ATTESTATION_FILE_UNSAFE");
  const fd = openSync(actual, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd);
    assert.equal(opened.ino, before.ino, "QA_ATTESTATION_CHANGED_DURING_OPEN");
    const content = readFileSync(fd);
    const after = fstatSync(fd);
    assert.ok(after.ino === before.ino && after.size === before.size &&
      after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs,
    "QA_ATTESTATION_CHANGED_DURING_READ");
    return content;
  } finally { closeSync(fd); }
}

export function verifyQaImageAttestation({ base, postgres, payloadPath, signaturePath,
  trustedPublicKeyPem = APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM,
  trustedPublicKeySha256 = APPROVED_QA_ATTESTOR_SPKI_SHA256,
  now = Date.now() }) {
  // The pinned public key is a reviewed trust anchor, never a CLI argument.
  // With the current null pin this fails before reading any input artifact.
  const key = assertQaAttestorPinned(trustedPublicKeyPem, trustedPublicKeySha256);
  const payloadBytes = readPrivateEvidence(payloadPath, 4096);
  const signature = readPrivateEvidence(signaturePath, 64);
  assert.equal(signature.length, 64, "QA_ATTESTATION_SIGNATURE_SIZE_INVALID");
  assert.ok(verifySignature(null, payloadBytes, key, signature),
    "QA_ATTESTATION_SIGNATURE_INVALID");
  const payload = JSON.parse(payloadBytes.toString("utf8"));
  assert.equal(payload.schema, "do-synthetic-qa-images-v1", "QA_ATTESTATION_SCHEMA_INVALID");
  assert.equal(payload.environment, "independent-approved-qa", "QA_ATTESTATION_ENV_INVALID");
  assert.equal(payload.purpose, "synthetic-disposable-guest-only", "QA_ATTESTATION_PURPOSE_INVALID");
  assert.equal(payload.noDevelopmentData, true, "QA_ATTESTATION_SOURCE_DATA_UNPROVEN");
  assert.equal(payload.noProductionData, true, "QA_ATTESTATION_PRODUCTION_DATA_UNPROVEN");
  assert.ok(Number.isSafeInteger(now), "QA_ATTESTATION_TIME_INVALID");
  for (const field of ["issuedAt", "expiresAt"])
    assert.equal(new Date(payload[field]).toISOString(), payload[field],
      "QA_ATTESTATION_TIME_INVALID");
  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);
  assert.ok(issued <= now && now < expires && expires - issued <= 24 * 60 * 60 * 1000,
    "QA_ATTESTATION_EXPIRED_OR_UNBOUNDED");
  assert.equal(payload.base?.sha256, base?.sha256, "QA_ATTESTATION_BASE_MISMATCH");
  assert.equal(payload.base?.bytes, base?.bytes, "QA_ATTESTATION_BASE_MISMATCH");
  assert.equal(payload.postgres?.sha256, postgres?.sha256, "QA_ATTESTATION_POSTGRES_MISMATCH");
  assert.equal(payload.postgres?.bytes, postgres?.bytes, "QA_ATTESTATION_POSTGRES_MISMATCH");
  assert.equal(payload.postgres?.imageId, QA_POSTGRES_IMAGE_ID,
    "QA_ATTESTATION_POSTGRES_IMAGE_MISMATCH");
  return { status: "SIGNED_SYNTHETIC_QA_IMAGE_ATTESTATION_ACCEPTED",
    attestorSpkiSha256: trustedPublicKeySha256, expiresAt: payload.expiresAt };
}
