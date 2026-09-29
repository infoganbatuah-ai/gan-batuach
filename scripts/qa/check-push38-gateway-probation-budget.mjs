import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayProbationBudgetManifest,
  PUSH38_GATEWAY_PROBATION_BUDGET as item } from
  "../../services/video-gateway/push38-home-qa-gateway-probation-budget.mjs";
import { issuePush38GatewayProbationBudget } from
  "../release/issue-push38-home-qa-gateway-probation-budget.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayProbationBudgetManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.31-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.23-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.23-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-probation-budget-test-"));
try {
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/test",
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: "b".repeat(64) };
  await assert.rejects(issuePush38GatewayProbationBudget({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_PROBATION_BUDGET_SIGNING_CONTEXT_INVALID/);
  const server = readFileSync("services/video-gateway/server.mjs", "utf8");
  assert.match(server, /PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS/);
  assert.match(server, /provisionalHandoffs/);
  const registration = readFileSync(
    "scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const activation = readFileSync(
    "scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  assert.match(registration, /--probation-budget/);
  assert.match(activation, /--probation-budget/);
  assert.match(activation, /connectorGenericRtspItem/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
