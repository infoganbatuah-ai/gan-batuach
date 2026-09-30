import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayCodecPreservationManifest,
  PUSH38_GATEWAY_CODEC_PRESERVATION as item } from
  "../../services/video-gateway/push38-home-qa-gateway-codec-preservation.mjs";
import { issuePush38GatewayCodecPreservation } from
  "../release/issue-push38-home-qa-gateway-codec-preservation.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayCodecPreservationManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.35-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.31-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.31-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-codec-preservation-test-"));
try {
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/test",
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: "b".repeat(64) };
  await assert.rejects(issuePush38GatewayCodecPreservation({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_CODEC_PRESERVATION_SIGNING_CONTEXT_INVALID/);
  const probe = readFileSync("services/video-gateway/probe-result.mjs", "utf8");
  const policy = readFileSync("services/video-gateway/private-nvr-session-policy.mjs", "utf8");
  const server = readFileSync("services/video-gateway/server.mjs", "utf8");
  assert.match(probe, /codec_name/);
  assert.match(policy, /PRIVATE_NVR_MAX_ROUTINE_PROBATIONS =\s*\n\s*PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS - 1/);
  assert.match(server, /maximumRoutineProbations/);
  assert.match(server, /right\[2\] === "OUTPUT_RESCUE"/);
  const registration = readFileSync(
    "scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const activation = readFileSync(
    "scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const publisher = readFileSync(
    "scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", "utf8");
  assert.match(registration, /--gateway-codec-preservation/);
  assert.match(activation, /--gateway-codec-preservation/);
  assert.match(publisher, /--gateway-codec-preservation/);
  assert.match(activation, /codecPreservation \? connectorCodecPreservationItem/);
  assert.match(activation, /codecPreservation \? 47/);
  assert.match(activation,
    /rescueCapacity \|\| codecPreservation \|\| handoffHardware\)\s*\n\s*\? item\.agentPredecessorReleaseId/);
  assert.match(activation, /codecPreservation \? "gateway_remediation_codec_preservation\.json"/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
