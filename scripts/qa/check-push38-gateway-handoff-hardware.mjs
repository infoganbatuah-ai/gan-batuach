import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayHandoffHardwareManifest,
  PUSH38_GATEWAY_HANDOFF_HARDWARE as item } from
  "../../services/video-gateway/push38-home-qa-gateway-handoff-hardware.mjs";
import { issuePush38GatewayHandoffHardware } from
  "../release/issue-push38-home-qa-gateway-handoff-hardware.mjs";
import { shouldQuarantineHardwareTranscoder } from
  "../../services/video-gateway/hardware-transcoder.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayHandoffHardwareManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.36-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.35-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.35-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 9,
  stopReason: "WARM_HANDOFF" }), false);
assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 1 }), true);

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-handoff-hardware-test-"));
try {
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/test",
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: "b".repeat(64) };
  await assert.rejects(issuePush38GatewayHandoffHardware({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_HANDOFF_HARDWARE_SIGNING_CONTEXT_INVALID/);
  const registration = readFileSync(
    "scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const activation = readFileSync(
    "scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const publisher = readFileSync(
    "scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", "utf8");
  for (const source of [registration, activation, publisher])
    assert.match(source, /--gateway-handoff-hardware/);
  assert.match(activation, /handoffHardware \? 48/);
  assert.match(activation, /handoffHardware \? "gateway_remediation_handoff_hardware\.json"/);
  assert.match(activation, /hardwareHandoff: handoffHardware/);
  assert.match(activation, /recentMaxAgeMs: handoffHardware \? 60 \* 60_000 : 10 \* 60_000/);
  assert.match(activation, /softwareFallbackHasOutputFailureEvidence/);
  assert.match(activation, /warmHandoffs >= 1[\s\S]*encoder === "videotoolbox"/);
  const shadow = readFileSync("scripts/qa/run-push38-dvr-shadow.mjs", "utf8");
  assert.match(shadow, /encoder: input\.encoder \?\? null/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
