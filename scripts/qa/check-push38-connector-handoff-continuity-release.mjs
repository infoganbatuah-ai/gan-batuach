import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38ConnectorHandoffContinuityManifest,
  PUSH38_CONNECTOR_HANDOFF_CONTINUITY as item } from
  "../../services/video-gateway/push38-home-qa-connector-handoff-continuity.mjs";
import { issuePush38ConnectorHandoffContinuity } from
  "../release/issue-push38-home-qa-connector-handoff-continuity.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const document = buildPush38ConnectorHandoffContinuityManifest({ signingKeyId: "fixture-release-key",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(document.release_id, item.releaseId);
assert.equal(document.version, "0.2.35-p38-health");
assert.equal(document.build_sha, item.buildSha);
assert.equal(document.artifact_sha256, item.digest);
assert.equal(document.artifact_size, item.size);
assert.equal(document.compatibility.minimum_current_version, "0.2.26-p38-health");
assert.equal(document.compatibility.maximum_current_version, "0.2.26-p38-health");
assert.equal(document.rollout.cohort_percent, 0);
assert.deepEqual(document.rollout.explicit_device_ids, [item.deviceId]);
for (const path of ["./register-push38-homeqa-connector-rtsp-session.mjs",
  "./activate-push38-homeqa-connector-rtsp-session.mjs",
  "../release/publish-push38-connector-pidfix-r2.mjs"])
  assert.match(readFileSync(new URL(path, import.meta.url), "utf8"), /handoffContinuity/);
const publisher = readFileSync(new URL(
  "../release/publish-push38-connector-pidfix-r2.mjs", import.meta.url), "utf8");
for (const safeguard of ["CreateMultipartUploadCommand", "UploadPartCommand",
  "CompleteMultipartUploadCommand", "AbortMultipartUploadCommand", "16 * 1024 * 1024",
  "IfNoneMatch: \"*\""])
  assert.ok(publisher.includes(safeguard), `missing large-artifact safeguard: ${safeguard}`);
assert.match(readFileSync(new URL(
  "../../services/video-gateway/home-qa-transition-phase.mjs", import.meta.url), "utf8"),
new RegExp(item.releaseId));

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-connector-handoff-continuity-test-"));
try {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  const privateDer = privateKey.export({ format: "der", type: "pkcs8" });
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "output"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:us-east-1:111122223333:key/11111111-2222-3333-4444-555555555555",
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex") };
  const call = async (operation, input) => operation === "describe-key"
    ? { KeyMetadata: { Arn: env.SIGNER_KEY_ARN, KeySpec: "ECC_NIST_EDWARDS25519",
      KeyUsage: "SIGN_VERIFY", KeyState: "Enabled", KeyManager: "CUSTOMER", Origin: "AWS_KMS" } }
    : operation === "get-public-key"
      ? { KeyId: env.SIGNER_KEY_ARN, PublicKey: publicDer.toString("base64"),
        KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
        SigningAlgorithms: ["ED25519_SHA_512"] }
      : { KeyId: env.SIGNER_KEY_ARN,
        Signature: sign(null, Buffer.from(input.Message, "base64"),
          { key: privateDer, format: "der", type: "pkcs8" }).toString("base64"),
        SigningAlgorithm: "ED25519_SHA_512" };
  const issued = await issuePush38ConnectorHandoffContinuity({ env, call });
  assert.equal(issued.release_id, item.releaseId);
  assert.equal(issued.signature_verified, true);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId,
  quarantined_predecessor: item.supersedesReleaseId }));
