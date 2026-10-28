import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync,
  truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as tar from "tar";
import { APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM, assertQaAttestorPinned,
  assertQaImageTargetCapacity, assertQaImageTransferBoundary, inspectQaDockerSaveArchive,
  parseQaImageArguments,
  MAX_QA_BASE_IMAGE_BYTES, QA_POSTGRES_IMAGE, QA_POSTGRES_IMAGE_ID, verifyIndependentQaBaseImage,
  verifyIndependentQaImage, verifyQaImageAttestation } from "./synthetic-qa-image-input.mjs";

const sha = value => createHash("sha256").update(value).digest("hex");

function dockerSaveFixture({ architecture = "arm64", tamperLayer = -1,
  omitLayer = -1, imageTag = QA_POSTGRES_IMAGE, extraEntry = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "do-docker-save-qa."));
  const source = join(root, "source");
  mkdirSync(source, { mode: 0o700 });
  const layers = [], diffIds = [], files = [];
  for (let index = 0; index < 29; index++) {
    const path = `layers/${String(index).padStart(2, "0")}/layer.tar`;
    const original = Buffer.from(`synthetic uncompressed layer ${index}\n`);
    diffIds.push(`sha256:${sha(original)}`);
    layers.push(path);
    if (index === omitLayer) continue;
    mkdirSync(join(source, "layers", String(index).padStart(2, "0")),
      { recursive: true, mode: 0o700 });
    writeFileSync(join(source, path), index === tamperLayer
      ? Buffer.from(`changed synthetic layer ${index}\n`) : original);
    files.push(path);
  }
  const config = Buffer.from(JSON.stringify({ architecture, os: "linux",
    rootfs: { type: "layers", diff_ids: diffIds } }));
  writeFileSync(join(source, "supabase-postgres-arm64-config.json"), config);
  writeFileSync(join(source, "manifest.json"), JSON.stringify([{
    Config: "supabase-postgres-arm64-config.json", RepoTags: [imageTag], Layers: layers
  }]));
  const tarPath = join(root, "docker-save.tar");
  if (extraEntry) {
    writeFileSync(join(source, "unexpected.txt"), "not an image member");
    files.push("unexpected.txt");
  }
  tar.c({ file: tarPath, cwd: source, sync: true, portable: true },
    ["supabase-postgres-arm64-config.json", "manifest.json", ...files]);
  return { tarPath, imageId: `sha256:${sha(config)}`,
    cleanup() { rmSync(root, { recursive: true }); } };
}

test("offline Docker-save parser binds ARM64 config, tag, layer order and 29 diff IDs", async () => {
  const f = dockerSaveFixture();
  try {
    assert.deepEqual(await inspectQaDockerSaveArchive(f.tarPath, f.imageId), {
      imageId: f.imageId, architecture: "arm64", layerCount: 29,
      layerDigestKind: "uncompressed-diff-id" });
    await assert.rejects(inspectQaDockerSaveArchive(f.tarPath,
      `sha256:${"0".repeat(64)}`), /QA_DOCKER_SAVE_IMAGE_ID_MISMATCH/);
  } finally { f.cleanup(); }
});

test("offline Docker-save parser rejects wrong architecture, missing and modified layers", async () => {
  for (const variant of [
    { input: { architecture: "amd64" }, error: /QA_DOCKER_SAVE_ARCH_INVALID/ },
    { input: { omitLayer: 7 }, error: /QA_DOCKER_SAVE_ENTRY_COUNT_INVALID/ },
    { input: { tamperLayer: 12 }, error: /QA_DOCKER_SAVE_LAYER_DIGEST_MISMATCH/ },
    { input: { extraEntry: true }, error: /QA_DOCKER_SAVE_ENTRY_INVALID/ },
    { input: { imageTag: "unapproved.example/postgres:latest" },
      error: /QA_DOCKER_SAVE_TAG_INVALID/ }
  ]) {
    const f = dockerSaveFixture(variant.input);
    try { await assert.rejects(inspectQaDockerSaveArchive(f.tarPath, f.imageId),
      variant.error); }
    finally { f.cleanup(); }
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "do-independent-image-qa."));
  const tarPath = join(root, "postgres-qa.tar");
  const basePath = join(root, "lima-base-qa.img");
  const content = Buffer.from("synthetic image input fixture; not a Docker archive\n");
  const baseContent = Buffer.from("synthetic base image fixture; not a Lima image\n");
  writeFileSync(tarPath, content, { mode: 0o600 });
  writeFileSync(basePath, baseContent, { mode: 0o600 });
  return { root, tarPath, sha256: sha(content), basePath, baseSha256: sha(baseContent),
    cleanup() { rmSync(root, { recursive: true }); } };
}

function attestation(f, overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ format: "pem", type: "spki" });
  const keySha256 = sha(publicKey.export({ format: "der", type: "spki" }));
  const issuedAt = new Date(Date.now() - 1000).toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const payload = { schema: "do-synthetic-qa-images-v1",
    environment: "independent-approved-qa", purpose: "synthetic-disposable-guest-only",
    noDevelopmentData: true, noProductionData: true, issuedAt, expiresAt,
    base: { sha256: f.baseSha256, bytes: readFileSync(f.basePath).length },
    postgres: { sha256: f.sha256, bytes: readFileSync(f.tarPath).length,
      imageId: QA_POSTGRES_IMAGE_ID }, ...overrides };
  const payloadPath = join(f.root, "qa-attestation.json");
  const signaturePath = join(f.root, "qa-attestation.sig");
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  writeFileSync(payloadPath, payloadBytes, { mode: 0o600 });
  writeFileSync(signaturePath, sign(null, payloadBytes, privateKey), { mode: 0o600 });
  return { payloadPath, signaturePath, pem, keySha256 };
}

test("independent QA image input requires explicit path and digest", () => {
  const f = fixture();
  try {
    const args = ["--qa-base-image", f.basePath, "--qa-base-sha256", f.baseSha256,
      "--qa-image-tar", f.tarPath, "--qa-image-sha256", f.sha256,
      "--qa-attestation-payload", join(f.root, "receipt.json"),
      "--qa-attestation-signature", join(f.root, "receipt.sig")];
    assert.deepEqual(parseQaImageArguments(args), {
      base: { path: f.basePath, sha256: f.baseSha256 },
      postgres: { tarPath: f.tarPath, sha256: f.sha256 },
      attestation: { payloadPath: join(f.root, "receipt.json"),
        signaturePath: join(f.root, "receipt.sig") } });
    assert.throws(() => parseQaImageArguments([]), /QA_IMAGE_ARGUMENTS_REQUIRED/);
    assert.throws(() => parseQaImageArguments(args.slice(0, 8)),
      /QA_IMAGE_ARGUMENTS_REQUIRED/);
    assert.throws(() => parseQaImageArguments(args.slice(0, 4)),
      /QA_IMAGE_ARGUMENTS_REQUIRED/);
    assert.throws(() => parseQaImageArguments(["--wrong", ...args.slice(1)]),
      /QA_IMAGE_ARGUMENTS_INVALID/);
    assert.throws(() => parseQaImageArguments(args.map((value, index) =>
      index === 3 ? "not-a-digest" : value)), /QA_IMAGE_DIGEST_REQUIRED/);
  } finally { f.cleanup(); }
});

test("independent QA image input verifies private regular file and exact SHA-256", async () => {
  const f = fixture();
  try {
    const result = await verifyIndependentQaImage(f);
    const base = await verifyIndependentQaBaseImage({ path: f.basePath,
      sha256: f.baseSha256 });
    assert.equal(result.sha256, f.sha256);
    assert.equal(result.imageReference, QA_POSTGRES_IMAGE);
    assert.equal(result.imageId, QA_POSTGRES_IMAGE_ID);
    assert.equal(result.provenance, "OWNER_ATTESTATION_REQUIRED");
    assert.equal(result.bytes, readFileSync(f.tarPath).length);
    assert.equal(base.kind, "lima-base-aarch64");
    assert.equal(base.sha256, f.baseSha256);
    await assert.rejects(verifyIndependentQaImage({ ...f, sha256: "0".repeat(64) }),
      /QA_IMAGE_DIGEST_MISMATCH/);
    await assert.rejects(verifyIndependentQaBaseImage({ path: f.basePath,
      sha256: "0".repeat(64) }), /QA_IMAGE_DIGEST_MISMATCH/);
    chmodSync(f.tarPath, 0o644);
    await assert.rejects(verifyIndependentQaImage(f), /QA_IMAGE_FILE_UNSAFE/);
  } finally { f.cleanup(); }
});

test("independent QA image input rejects missing, symlinked, and project-source paths", async () => {
  const f = fixture();
  try {
    await assert.rejects(verifyIndependentQaImage({ tarPath: join(f.root, "missing.tar"),
      sha256: f.sha256 }), /ENOENT/);
    const link = join(f.root, "link.tar");
    symlinkSync(f.tarPath, link);
    await assert.rejects(verifyIndependentQaImage({ tarPath: link, sha256: f.sha256 }),
      /QA_IMAGE_SYMLINK_DENIED/);
    const hardlink = join(f.root, "hardlink.tar");
    linkSync(f.tarPath, hardlink);
    await assert.rejects(verifyIndependentQaImage(f), /QA_IMAGE_FILE_UNSAFE/);
    const baseLink = join(f.root, "base-link.img");
    symlinkSync(f.basePath, baseLink);
    await assert.rejects(verifyIndependentQaBaseImage({ path: baseLink,
      sha256: f.baseSha256 }), /QA_IMAGE_SYMLINK_DENIED/);
    const source = fileURLToPath(import.meta.url);
    await assert.rejects(verifyIndependentQaImage({ tarPath: source, sha256: f.sha256 }),
      /QA_IMAGE_SOURCE_NOT_INDEPENDENT/);
    await assert.rejects(verifyIndependentQaBaseImage({ path: source,
      sha256: f.baseSha256 }), /QA_IMAGE_SOURCE_NOT_INDEPENDENT/);
    await assert.rejects(verifyIndependentQaBaseImage({
      path: "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/nonexistent-qa.img",
      sha256: f.baseSha256 }), /QA_IMAGE_SOURCE_NOT_INDEPENDENT/);
  } finally { f.cleanup(); }
});

test("oversized QA base image is denied before hashing or guest setup", async () => {
  const f = fixture();
  try {
    truncateSync(f.basePath, MAX_QA_BASE_IMAGE_BYTES + 1);
    await assert.rejects(verifyIndependentQaBaseImage({ path: f.basePath,
      sha256: f.baseSha256 }), /QA_IMAGE_FILE_UNSAFE/);
  } finally { f.cleanup(); }
});

test("transfer boundary requires encrypted target, no host mount and denied egress", () => {
  const proof = { encrypted: true, noHostMounts: true, noProxyEnv: true,
    guestIpv4OutputDrop: true, guestIpv6OutputDrop: true,
    guestIpv4ForwardDrop: true, guestIpv6ForwardDrop: true,
    ipv4EgressProbeDenied: true, ipv6EgressProbeDenied: true,
    dnsResolutionProbeDenied: true, dnsHasNoAllowRule: true };
  assert.doesNotThrow(() => assertQaImageTransferBoundary(proof));
  for (const field of Object.keys(proof))
    assert.throws(() => assertQaImageTransferBoundary({ ...proof, [field]: false }), /UNPROVEN/);
});

test("image transfer requires capacity for both copies and reserve", () => {
  const baseBytes = 512 * 1024 ** 2;
  const postgresBytes = 512 * 1024 ** 2;
  const required = baseBytes + 2 * postgresBytes + 7 * 1024 ** 3;
  assert.doesNotThrow(() => assertQaImageTargetCapacity(required, baseBytes,
    postgresBytes));
  assert.throws(() => assertQaImageTargetCapacity(required - 1, baseBytes,
    postgresBytes), /QA_IMAGE_TARGET_CAPACITY_UNPROVEN/);
});

test("no trusted attestor is pinned: fail before reading image or starting guest", () => {
  assert.equal(APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM, null);
  assert.throws(() => assertQaAttestorPinned(), /QA_ATTESTOR_NOT_PINNED/);
  assert.throws(() => verifyQaImageAttestation({}), /QA_ATTESTOR_NOT_PINNED/);
});

test("signed QA provenance binds both exact artifacts and expires", async () => {
  const f = fixture();
  try {
    const receipt = attestation(f);
    const base = await verifyIndependentQaBaseImage({ path: f.basePath,
      sha256: f.baseSha256 });
    const postgres = await verifyIndependentQaImage(f);
    const args = { base, postgres, payloadPath: receipt.payloadPath,
      signaturePath: receipt.signaturePath,
      trustedPublicKeyPem: receipt.pem,
      trustedPublicKeySha256: receipt.keySha256 };
    assert.equal(verifyQaImageAttestation(args).status,
      "SIGNED_SYNTHETIC_QA_IMAGE_ATTESTATION_ACCEPTED");
    assert.throws(() => verifyQaImageAttestation({ ...args, now: Date.now() + 90_000 }),
      /QA_ATTESTATION_EXPIRED_OR_UNBOUNDED/);
    assert.throws(() => verifyQaImageAttestation({ ...args,
      trustedPublicKeySha256: "0".repeat(64) }), /QA_ATTESTOR_KEY_PIN_MISMATCH/);
    assert.throws(() => verifyQaImageAttestation({ ...args,
      base: { ...base, sha256: "0".repeat(64) } }), /QA_ATTESTATION_BASE_MISMATCH/);
    assert.throws(() => verifyQaImageAttestation({ ...args,
      postgres: { ...postgres, bytes: postgres.bytes + 1 } }),
    /QA_ATTESTATION_POSTGRES_MISMATCH/);
    writeFileSync(receipt.payloadPath, JSON.stringify({ forged: true }), { mode: 0o600 });
    assert.throws(() => verifyQaImageAttestation(args), /QA_ATTESTATION_SIGNATURE_INVALID/);
    rmSync(receipt.payloadPath);
    assert.throws(() => verifyQaImageAttestation(args), /ENOENT/);
  } finally { f.cleanup(); }
});

test("a valid signature cannot authorize the wrong QA environment", async () => {
  const f = fixture();
  try {
    const receipt = attestation(f, { environment: "unapproved-test" });
    const base = await verifyIndependentQaBaseImage({ path: f.basePath,
      sha256: f.baseSha256 });
    const postgres = await verifyIndependentQaImage(f);
    assert.throws(() => verifyQaImageAttestation({ base, postgres,
      payloadPath: receipt.payloadPath, signaturePath: receipt.signaturePath,
      trustedPublicKeyPem: receipt.pem,
      trustedPublicKeySha256: receipt.keySha256 }), /QA_ATTESTATION_ENV_INVALID/);
  } finally { f.cleanup(); }
});

test("guest runner has neither original image source nor network pull path", () => {
  const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)),
    "run-isolated-encrypted-restore-architecture-qa.mjs"), "utf8");
  assert.doesNotMatch(script, /cachedBase|sourceDocker|colima\/gbi\/docker\.sock|"image", "save"|"image", "pull"/);
  assert.doesNotMatch(script, /\/Volumes\/DIGITAL_OBSERVER\/Development\/gan-batuach/);
  assert.match(script, /verifyIndependentQaBaseImage\(qaArguments\.base\)/);
  assert.match(script, /verifyIndependentQaImage\(qaArguments\.postgres\)/);
  assert.match(script, /verifyPinnedQaDockerSave\(/);
  assert.ok(script.indexOf("assertQaAttestorPinned()") <
    script.indexOf("verifyIndependentQaBaseImage(qaArguments.base"));
  assert.ok(script.indexOf("assertQaAttestorPinned()") <
    script.indexOf("verifyPinnedQaDockerSave("));
  assert.ok(script.indexOf("verifyQaImageAttestation({") <
    script.indexOf("mkdtempSync(join(worktree"));
  assert.match(script, /assertQaImageTransferBoundary\(evidence\)/);
  assert.match(script, /location: \$\{baseImage\}/);
  assert.match(script, /"image", "load"/);
  assert.match(script, /GUEST_POSTGRES_IMAGE_MISMATCH/);
  assert.match(script, /--pull", "never/);
  assert.doesNotMatch(script, /aws s3|wrangler|docker\.io\/pull/);
});
