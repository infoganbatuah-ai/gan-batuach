import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { issuePush38GatewayProactiveExclusiveRenewal } from
  "../release/issue-push38-home-qa-gateway-proactive-exclusive-renewal.mjs";
import { buildPush38GatewayProactiveExclusiveRenewalManifest,
  PUSH38_GATEWAY_PROACTIVE_EXCLUSIVE_RENEWAL as release } from
  "../../services/video-gateway/push38-home-qa-gateway-proactive-exclusive-renewal.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
for (const [relativePath, requiredFragments] of [
  ["../release/publish-push38-gateway-finite-stream-handoff-r2.mjs", [
    "--gateway-proactive-exclusive",
    "buildPush38GatewayProactiveExclusiveRenewalManifest",
    "observer-push38-gateway-proactive-exclusive-renewal-r2-publication-v1"
  ]],
  ["./register-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-proactive-exclusive",
    "gateway_remediation_proactive_exclusive_renewal.json",
    "GATEWAY_PROACTIVE_EXCLUSIVE_REGISTERED_DRAFT"
  ]],
  ["./activate-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-proactive-exclusive",
    "gateway_remediation_proactive_exclusive_renewal.json",
    "GATEWAY_PROACTIVE_EXCLUSIVE_PREFLIGHT_PASS",
    "EXACT_GATEWAY_PROACTIVE_EXCLUSIVE_ROLLOUT_ACTIVE"
  ]]
]) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  for (const fragment of requiredFragments) assert.equal(source.includes(fragment), true,
    `${relativePath} is missing ${fragment}`);
}
const built = buildPush38GatewayProactiveExclusiveRenewalManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: "2026-10-03T11:00:00.000Z"
}).document;
assert.equal(built.release_id, "qa-p38-health-gateway-proactive-exclusive-322642bf9294");
assert.equal(built.version, "0.2.68-p38-health");
assert.equal(built.build_sha, "66e6f1c1535df9ec821333af53ec925d29b0bbd6");
assert.equal(built.artifact_sha256,
  "322642bf929494dd2a013a61e9d68fa30fd859ad55eb0aac9767c57c75830610");
assert.equal(built.artifact_size, 135862758);
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [release.deviceId]);
assert.equal(built.compatibility.minimum_current_version, "0.2.64-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.64-p38-health");
assert.equal(release.failedLiveVersion, "0.2.67-p38-health");

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-proactive-exclusive-test-"));
try {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const keyArn = "arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001";
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: release.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: keyArn, SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex") };
  const call = async (operation, input) => {
    if (operation === "describe-key") return { KeyMetadata: { Arn: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY", KeyState: "Enabled",
      KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    if (operation === "get-public-key") return { KeyId: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicDer.toString("base64") };
    return { KeyId: keyArn, SigningAlgorithm: "ED25519_SHA_512",
      Signature: sign(null, Buffer.from(input.Message, "base64"), privateKey).toString("base64") };
  };
  const result = await issuePush38GatewayProactiveExclusiveRenewal({ env, call });
  assert.equal(result.signature_verified, true);
  const manifest = JSON.parse(readFileSync(join(env.HOME_QA_OUTPUT_DIR,
    "gateway_remediation_proactive_exclusive_renewal.json"), "utf8"));
  assert.equal(verifyEdgeUpdateManifest(manifest,
    { [env.SIGNER_KEY_ID]: publicDer.toString("base64url") }).ok, true);
  await assert.rejects(issuePush38GatewayProactiveExclusiveRenewal({
    env: { ...env, PUSH38_CANDIDATE_SHA: "f".repeat(40),
      HOME_QA_OUTPUT_DIR: join(temporary, "bad") }, call }),
  /P38_GATEWAY_PROACTIVE_EXCLUSIVE_SIGNING_CONTEXT_INVALID/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log("PUSH 38 Gateway proactive exclusive renewal release QA: PASS");
