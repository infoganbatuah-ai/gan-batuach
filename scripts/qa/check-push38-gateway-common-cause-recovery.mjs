import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPush38GatewayCommonCauseRecoveryManifest,
  PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY } from
  "../../services/video-gateway/push38-home-qa-gateway-common-cause-recovery.mjs";
import { shouldRefreshPrivateNvrSession } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");

test("Gateway common-cause recovery is an immutable exact-device release", () => {
  const manifest = buildPush38GatewayCommonCauseRecoveryManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.releaseId);
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.size);
  assert.equal(manifest.compatibility.minimum_current_version,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.rollbackVersion);
  assert.equal(manifest.compatibility.maximum_current_version,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.rollbackVersion);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.deviceId]);
});

test("only authentication rejection or corroborated common-cause loss may rotate the shared DVR session", () => {
  assert.equal(shouldRefreshPrivateNvrSession("authentication_rejected"), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media",
    { loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER }), false);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER,
    heartbeatConsecutiveFailures: 3, commonCauseSourceFailures: 8
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_transport_error"), false);
});

test("common-cause recovery is pinned to the signed 0.2.11 known-good release", () => {
  assert.match(installer, /--gateway-common-cause-recovery-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-common-cause-189e548bc104/);
  assert.match(installer, /qa-p38-health-gateway-session-e354546bdbf8/);
  assert.match(installer, /e354546bdbf8a222f98b9af5166de1b91ee353ff7d5e54111b4c5c931901cd0a/);
});

test("registration requires verified managed identity and disables broad cohorts", () => {
  assert.match(registration, /MANAGED_IDENTITY_VERIFIED/);
  assert.match(registration, /cohort_percent<>0/);
  assert.match(registration, /deployment_profile='PHYSICAL_GATEWAY'/);
  assert.match(registration, /runtime_writes: 0/);
});
