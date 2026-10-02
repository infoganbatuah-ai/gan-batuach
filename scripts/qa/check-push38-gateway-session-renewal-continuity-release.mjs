import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewaySessionRenewalContinuityManifest,
  PUSH38_GATEWAY_SESSION_RENEWAL_CONTINUITY as item } from
  "../../services/video-gateway/push38-home-qa-gateway-session-renewal-continuity.mjs";
import { issuePush38GatewaySessionRenewalContinuity } from
  "../release/issue-push38-home-qa-gateway-session-renewal-continuity.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewaySessionRenewalContinuityManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.66-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.64-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.64-p38-health");
assert.equal(built.compatibility.security_floor_version, "0.2.64-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(item.failedQualificationVersion, "0.2.65-p38-health");

for (const path of [
  new URL("../release/publish-push38-gateway-finite-stream-handoff-r2.mjs", import.meta.url),
  new URL("./register-push38-homeqa-gateway-common-cause-recovery.mjs", import.meta.url),
  new URL("./activate-push38-homeqa-gateway-common-cause-recovery.mjs", import.meta.url)
]) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /--gateway-session-renewal/);
  assert.match(source, /push38-home-qa-gateway-session-renewal-continuity/);
}

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-session-renewal-test-"));
try {
  const publicKey = Buffer.from("public-key-fixture");
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/00000000-0000-4000-8000-000000000000",
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicKey).digest("hex") };
  await assert.rejects(issuePush38GatewaySessionRenewalContinuity({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_SESSION_RENEWAL_SIGNING_CONTEXT_INVALID/);
  await assert.rejects(issuePush38GatewaySessionRenewalContinuity({ env, call: async operation =>
    operation === "get-public-key" ? { KeyId: env.SIGNER_KEY_ARN,
      PublicKey: publicKey.toString("base64") } : {} }),
  /REMOTE_SIGNER_KEY_CUSTODY_INVALID|REMOTE_SIGNER_RESPONSE_INVALID|P38_GATEWAY_SESSION_RENEWAL_SIGNED_MANIFEST_INVALID/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log("PUSH 38 Gateway session-renewal continuity release contract: PASS");
