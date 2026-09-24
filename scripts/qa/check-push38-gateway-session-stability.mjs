import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPush38GatewaySessionStabilityManifest,
  PUSH38_GATEWAY_SESSION_STABILITY } from
  "../../services/video-gateway/push38-home-qa-gateway-session-stability.mjs";
import { shouldRefreshPrivateNvrSession } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-session-stability.mjs", "utf8");

test("Gateway session stability is an immutable exact-device release", () => {
  const manifest = buildPush38GatewaySessionStabilityManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_SESSION_STABILITY.releaseId);
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_SESSION_STABILITY.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_SESSION_STABILITY.size);
  assert.equal(manifest.compatibility.minimum_current_version,
    PUSH38_GATEWAY_SESSION_STABILITY.rollbackVersion);
  assert.equal(manifest.compatibility.maximum_current_version,
    PUSH38_GATEWAY_SESSION_STABILITY.rollbackVersion);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_SESSION_STABILITY.deviceId]);
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

test("management upgrade is pinned to the signed 0.2.10 known-good release", () => {
  assert.match(installer, /--gateway-session-stability-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-session-e354546bdbf8/);
  assert.match(installer, /qa-p38-health-gateway-auth-4197f1a246f1/);
  assert.match(installer, /4197f1a246f1cf4dcb909d8b6e03651a05753c1b6fffdc727484e5410686bdef/);
});

test("registration requires verified managed identity and disables broad cohorts", () => {
  assert.match(registration, /MANAGED_IDENTITY_VERIFIED/);
  assert.match(registration, /cohort_percent<>0/);
  assert.match(registration, /deployment_profile='PHYSICAL_GATEWAY'/);
  assert.match(registration, /runtime_writes: 0/);
});
