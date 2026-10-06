import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38ManagedAuthContinuityManifest,
  PUSH38_MANAGED_AUTH_CONTINUITY } from
  "../../services/video-gateway/push38-home-qa-managed-auth-continuity.mjs";
import { canonicalEdgeUpdateManifest, verifyEdgeUpdateManifest } from
  "../../services/video-gateway/edge-update-contract.mjs";
import { issuePush38ManagedAuthContinuity } from
  "../release/issue-push38-home-qa-managed-auth-continuity.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
for (const component of ["connector", "gateway"]) {
  const item = PUSH38_MANAGED_AUTH_CONTINUITY[component];
  const built = buildPush38ManagedAuthContinuityManifest({ component,
    signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
    releasedAt: new Date().toISOString() }).document;
  assert.equal(built.release_id, item.releaseId);
  assert.equal(built.version, item.version);
  assert.equal(built.build_sha, item.buildSha);
  assert.equal(built.artifact_sha256, item.digest);
  assert.equal(built.artifact_size, item.size);
  assert.equal(built.compatibility.minimum_current_version, item.rollbackVersion);
  assert.equal(built.compatibility.maximum_current_version, item.rollbackVersion);
  assert.equal(built.rollout.cohort_percent, 0);
  assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);
}
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.version, "0.2.38-p38-health");
assert.notEqual(PUSH38_MANAGED_AUTH_CONTINUITY.connector.version, "0.2.37-p38-health",
  "the immutable 0.2.37 Connector slot belongs to an earlier signed release");

for (const [path, required] of [
  ["scripts/release/publish-push38-managed-auth-continuity-r2.mjs", [
    "observer-push38-managed-auth-continuity-r2-publication-v1",
    "anonymous_access_denied: true", "expiresIn: 120"
  ]],
  ["scripts/qa/register-push38-homeqa-managed-auth-continuity.mjs", [
    "MANAGED_AUTH_CONTINUITY_REGISTERED_DRAFT", "cohort_percent<>0",
    "MANAGED_IDENTITY_VERIFIED"
  ]],
  ["scripts/qa/activate-push38-homeqa-managed-auth-continuity.mjs", [
    "ota_agent_owns_install: true", "EXACT_MANAGED_AUTH_CONTINUITY_ROLLOUT_ACTIVE",
    "rollback_release_id"
  ]]
]) {
  const source = readFileSync(path, "utf8");
  for (const value of required) assert.ok(source.includes(value), `${path}:${value}`);
}

const pair = generateKeyPairSync("ed25519");
const publicDer = pair.publicKey.export({ format: "der", type: "spki" });
const keyArn =
  "arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001";
const temporary = mkdtempSync(join(tmpdir(), "observer-p38-managed-auth-release-test-"));
try {
  const result = await issuePush38ManagedAuthContinuity({ env: {
    GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing",
    GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: PUSH38_MANAGED_AUTH_CONTINUITY.connector.buildSha,
    RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "out"),
    SIGNER_KEY_ARN: keyArn,
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex"),
    HOME_QA_R2_ORIGIN: origin
  }, call: async (operation, input) => {
    if (operation === "describe-key") return { KeyMetadata: { Arn: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      KeyState: "Enabled", KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    if (operation === "get-public-key") return { KeyId: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicDer.toString("base64") };
    if (operation === "sign") return { KeyId: keyArn,
      Signature: sign(null, Buffer.from(input.Message, "base64"), pair.privateKey).toString("base64"),
      SigningAlgorithm: "ED25519_SHA_512" };
    throw new Error("unexpected operation");
  } });
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.signature_verified));
  assert.equal(lstatSync(join(temporary, "out")).isDirectory(), true);
  for (const component of ["connector", "gateway"]) {
    const document = buildPush38ManagedAuthContinuityManifest({ component,
      signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
      releasedAt: new Date().toISOString() }).document;
    document.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(document)), pair.privateKey)
      .toString("base64url");
    assert.equal(verifyEdgeUpdateManifest(document,
      { "observer-kms-release-v1": publicDer.toString("base64url") }).ok, true);
  }
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", exact_devices: 2, broad_cohort: false,
  protected_aws_signing_required: true, rollback_bound: true }));
