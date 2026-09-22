import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPush38GatewayAuthRecoveryManifest, PUSH38_GATEWAY_AUTH_RECOVERY } from
  "../../services/video-gateway/push38-home-qa-gateway-auth-recovery.mjs";

const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-auth-recovery.mjs", "utf8");
const rollbackRecovery = readFileSync("scripts/qa/recover-push38-homeqa-gateway-rollback.mjs", "utf8");
const signedRecovery = readFileSync("scripts/qa/authorize-push38-homeqa-gateway-signed-recovery.mjs", "utf8");

test("Gateway auth recovery is an immutable exact-device release", () => {
  const manifest = buildPush38GatewayAuthRecoveryManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_AUTH_RECOVERY.releaseId);
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_AUTH_RECOVERY.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_AUTH_RECOVERY.size);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids, [PUSH38_GATEWAY_AUTH_RECOVERY.deviceId]);
});

test("management upgrade is Gateway-scoped and pinned to the failed signed predecessor", () => {
  assert.match(installer, /--gateway-auth-recovery-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-auth-4197f1a246f1/);
  assert.match(installer, /qa-p38-health-gateway-6c9d08327ec6/);
  assert.match(installer, /6c9d08327ec6f38db3fc55c4c344f4db6fc0d0adab5c68e3ec3f1c1164f11c95/);
  assert.match(rollbackRecovery, /manager\.recoverActionRequiredRollback\(\)/);
  assert.match(rollbackRecovery, /adapter\.restart\(\{ slot: current\.slot, manifest, rollback: true \}\)/);
  assert.match(signedRecovery, /manager\.transition\("ROLLED_BACK"/);
  assert.match(signedRecovery, /release_installed: false/);
});

test("registration requires verified managed identity and disables every broad cohort", () => {
  assert.match(registration, /MANAGED_IDENTITY_VERIFIED/);
  assert.match(registration, /cohort_percent<>0/);
  assert.match(registration, /deployment_profile='PHYSICAL_GATEWAY'/);
  assert.match(registration, /production_writes: 0/);
});
