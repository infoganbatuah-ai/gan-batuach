import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayFiniteResponseContinuityManifest,
  PUSH38_GATEWAY_FINITE_RESPONSE_CONTINUITY as release } from
  "../../services/video-gateway/push38-home-qa-gateway-finite-response-continuity.mjs";
import { issuePush38GatewayFiniteResponseContinuity } from
  "../release/issue-push38-home-qa-gateway-finite-response-continuity.mjs";
import { verifyEdgeUpdateManifest } from
  "../../services/video-gateway/edge-update-contract.mjs";
import { homeQaManagedPhaseAllows } from
  "../../services/video-gateway/home-qa-transition-phase.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayFiniteResponseContinuityManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString()
}).document;
assert.equal(built.release_id,
  "qa-p38-health-gateway-finite-response-continuity-10c4c6d33593");
assert.equal(built.version, "0.2.76-p38-health");
assert.equal(built.build_sha, "591d5b97fa24a31ab540a7ceaef8ec9e5ad9335f");
assert.equal(built.artifact_sha256,
  "10c4c6d33593f4c2796789eecb24faa0abd9c26448c8a6190600f61742dd140c");
assert.equal(built.artifact_size, 135864938);
assert.equal(built.compatibility.minimum_current_version, "0.2.75-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.75-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [release.deviceId]);
assert.equal(release.failedV8Version, "0.2.75-p38-health");
assert.equal(release.failedV8ResultSha256,
  "dd46c2f58102ea1fd00828323c38634ac1614b9dfced56895be73759697755ec");
assert.equal(release.failedV8CheckpointsSha256,
  "6e65bae6257f5a15c7ce7108752b755be81c2b2d113afad7ec1a2e91afabfbae");
assert.equal(release.failedV8SummarySha256,
  "d3e4f2d5aa143dd67bc0394b74fd75114e27f80e7bd3f56d1a69f440f0b34a56");
const managedGateway = {
  gateway_id: release.deviceId,
  deployment_profile: release.profile,
  identity_scheme: "ED25519_V1",
  credential_version: 1,
  metadata: {
    home_qa_phase: "MANAGED_IDENTITY_VERIFIED",
    home_qa_proof_sha256: "a".repeat(64),
    home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f"
  }
};
assert.equal(homeQaManagedPhaseAllows({ enrollment: managedGateway, manifest: built }), true);
assert.equal(homeQaManagedPhaseAllows({
  enrollment: { ...managedGateway, gateway_id: "00000000-0000-4000-8000-000000000000" },
  manifest: built
}), false);

for (const [path, required] of [
  ["scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", [
    "--gateway-finite-response-continuity",
    "observer-push38-gateway-finite-response-continuity-r2-publication-v1"
  ]],
  ["scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-finite-response-continuity",
    "gateway_remediation_finite_response_continuity.json",
    "failedV8ReleaseId"
  ]],
  ["scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-finite-response-continuity",
    "gateway_remediation_finite_response_continuity.json",
    "P38_GATEWAY_FINITE_RESPONSE_CONTINUITY_FAILED_V8_PROOF_INVALID",
    "failed-v8-evidence",
    "failed-v8-checkpoints",
    "failed-v8-summary"
  ]]
]) {
  const source = readFileSync(path, "utf8");
  for (const value of required) assert.match(source, new RegExp(value));
}

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-finite-response-test-"));
try {
  const output = join(temporary, "signed");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const { createHash } = await import("node:crypto");
  const keyArn = "arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001";
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: release.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: output, HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: keyArn,
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex") };
  const call = async (operation, input) => {
    if (operation === "describe-key") return { KeyMetadata: { Arn: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY", KeyState: "Enabled",
      KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    if (operation === "get-public-key") return { KeyId: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicDer.toString("base64") };
    if (operation === "sign") return { KeyId: keyArn,
      SigningAlgorithm: "ED25519_SHA_512",
      Signature: sign(null, Buffer.from(input.Message, "base64"), privateKey).toString("base64") };
    throw new Error("unexpected operation");
  };
  await assert.rejects(issuePush38GatewayFiniteResponseContinuity({
    env: { ...env, GITHUB_REF: "refs/heads/main" }, call }),
  /P38_GATEWAY_FINITE_RESPONSE_CONTINUITY_SIGNING_CONTEXT_INVALID/);
  const issued = await issuePush38GatewayFiniteResponseContinuity({ env, call });
  assert.equal(issued.release_id, release.releaseId);
  const manifest = JSON.parse(readFileSync(join(output,
    "gateway_remediation_finite_response_continuity.json"), "utf8"));
  assert.equal(verifyEdgeUpdateManifest(manifest,
    { [env.SIGNER_KEY_ID]: publicDer.toString("base64url") }).ok, true);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log("PUSH 38 Gateway finite-response continuity release QA: PASS");
