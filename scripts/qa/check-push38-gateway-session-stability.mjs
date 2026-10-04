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

test("finite-response reopen rejection is distinct from ordinary transport failure", () => {
  assert.equal(shouldRefreshPrivateNvrSession("authentication_rejected"), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media",
    { loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER }), false);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER,
    heartbeatConsecutiveFailures: 3, commonCauseSourceFailures: 8
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    previousRelayExitReason: "SOURCE_STREAM_ENDED"
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    previousRelayExitReason: "SOURCE_RESPONSE_RETIRED"
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    previousRelayExitReason: "UPSTREAM_UND_ERR_SOCKET"
  }), false);
  assert.equal(shouldRefreshPrivateNvrSession("source_transport_error"), false);
});

test("finite renewal counts clean ends and proven response retirements", async () => {
  const { classifyContinuousSessionRenewal } = await import(
    "./push38-shadow-qualification-policy.mjs");
  const checkpoint = {
    shadow: { http: 200, media: { progressing: 1, renewing: 0, stalled: 0 } },
    renewal: { status: 200, playlist_status: 200, segment_status: 200,
      segment_bytes: 1 }
  };
  const result = classifyContinuousSessionRenewal({
    session: { rotations: 2, login_succeeded: 3, logout_succeeded: 2,
      logout_failed: 0, retired_session_backlog: 0,
      last_rotation_reason: "finite_response_reopen_rejected",
      proactive_attempts: 0, proactive_succeeded: 0 },
    lifecycle: { startsByReason: { recovery: 2 }, upstreamEnded: 1,
      responseRetired: 1, inputSocketError: 2, staleInput: 0,
      stalePlaylist: 0, staleOnRequest: 0 },
    checkpoints: [checkpoint, checkpoint], expectedProgressing: 1
  });
  assert.equal(result.pass, true);
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
