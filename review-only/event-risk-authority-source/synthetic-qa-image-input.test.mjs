import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync,
  writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertQaImageTargetCapacity, assertQaImageTransferBoundary, parseQaImageArguments,
  QA_POSTGRES_IMAGE, QA_POSTGRES_IMAGE_ID, verifyIndependentQaImage } from "./synthetic-qa-image-input.mjs";

const sha = value => createHash("sha256").update(value).digest("hex");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "do-independent-image-qa."));
  const tarPath = join(root, "postgres-qa.tar");
  const content = Buffer.from("synthetic image input fixture; not a Docker archive\n");
  writeFileSync(tarPath, content, { mode: 0o600 });
  return { root, tarPath, sha256: sha(content),
    cleanup() { rmSync(root, { recursive: true }); } };
}

test("independent QA image input requires explicit path and digest", () => {
  const f = fixture();
  try {
    assert.deepEqual(parseQaImageArguments(["--qa-image-tar", f.tarPath,
      "--qa-image-sha256", f.sha256]), { tarPath: f.tarPath, sha256: f.sha256 });
    assert.throws(() => parseQaImageArguments([]), /QA_IMAGE_ARGUMENTS_REQUIRED/);
    assert.throws(() => parseQaImageArguments(["--qa-image-tar", f.tarPath]),
      /QA_IMAGE_ARGUMENTS_REQUIRED/);
    assert.throws(() => parseQaImageArguments(["--qa-image-tar", f.tarPath,
      "--qa-image-sha256", "not-a-digest"]), /QA_IMAGE_DIGEST_REQUIRED/);
  } finally { f.cleanup(); }
});

test("independent QA image input verifies private regular file and exact SHA-256", async () => {
  const f = fixture();
  try {
    const result = await verifyIndependentQaImage(f);
    assert.equal(result.sha256, f.sha256);
    assert.equal(result.imageReference, QA_POSTGRES_IMAGE);
    assert.equal(result.imageId, QA_POSTGRES_IMAGE_ID);
    assert.equal(result.provenance, "OWNER_ATTESTATION_REQUIRED");
    assert.equal(result.bytes, readFileSync(f.tarPath).length);
    await assert.rejects(verifyIndependentQaImage({ ...f, sha256: "0".repeat(64) }),
      /QA_IMAGE_DIGEST_MISMATCH/);
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
    const source = fileURLToPath(import.meta.url);
    await assert.rejects(verifyIndependentQaImage({ tarPath: source, sha256: f.sha256 }),
      /QA_IMAGE_SOURCE_NOT_INDEPENDENT/);
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
  const imageBytes = 512 * 1024 ** 2;
  assert.doesNotThrow(() => assertQaImageTargetCapacity(2 * imageBytes + 1024 ** 3,
    imageBytes));
  assert.throws(() => assertQaImageTargetCapacity(2 * imageBytes + 1024 ** 3 - 1,
    imageBytes), /QA_IMAGE_TARGET_CAPACITY_UNPROVEN/);
});

test("guest runner has no source Docker socket, image export or network pull path", () => {
  const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)),
    "run-isolated-encrypted-restore-architecture-qa.mjs"), "utf8");
  assert.doesNotMatch(script, /sourceDocker|colima\/gbi\/docker\.sock|"image", "save"|"image", "pull"/);
  assert.match(script, /verifyIndependentQaImage\(parseQaImageArguments\(process\.argv\.slice\(2\)\)\)/);
  assert.ok(script.indexOf("verifyIndependentQaImage(parseQaImageArguments") <
    script.indexOf("mkdtempSync(join(worktree"));
  assert.match(script, /assertQaImageTransferBoundary\(evidence\)/);
  assert.match(script, /"image", "load"/);
  assert.match(script, /GUEST_POSTGRES_IMAGE_MISMATCH/);
  assert.match(script, /--pull", "never/);
  assert.doesNotMatch(script, /aws s3|wrangler|docker\.io\/pull/);
});
