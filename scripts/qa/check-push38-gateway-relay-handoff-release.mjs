import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayRelayHandoffRemediationManifest,
  PUSH38_GATEWAY_RELAY_HANDOFF_REMEDIATION as item } from
  "../../services/video-gateway/push38-home-qa-gateway-relay-handoff-remediation.mjs";
import { issuePush38GatewayRelayHandoffRemediation } from
  "../release/issue-push38-home-qa-gateway-relay-handoff-remediation.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayRelayHandoffRemediationManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.37-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.36-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.36-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-relay-handoff-test-"));
try {
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/test",
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: "b".repeat(64) };
  await assert.rejects(issuePush38GatewayRelayHandoffRemediation({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_RELAY_HANDOFF_SIGNING_CONTEXT_INVALID/);
  const registration = readFileSync(
    "scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const activation = readFileSync(
    "scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const publisher = readFileSync(
    "scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", "utf8");
  for (const source of [registration, activation, publisher])
    assert.match(source, /--gateway-relay-handoff/);
  assert.match(activation, /relayHandoff \? 49/);
  assert.match(activation, /relayHandoff \? "gateway_remediation_relay_handoff\.json"/);
  assert.match(activation, /failedPreSoakEvidence/);
  assert.match(activation, /relay_start_delta < 400/);
  assert.match(activation, /stale_input_delta < 200/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
