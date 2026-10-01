import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38GatewayMaintenanceIsolationManifest,
  PUSH38_GATEWAY_MAINTENANCE_ISOLATION as item
} from "../../services/video-gateway/push38-home-qa-gateway-maintenance-isolation.mjs";

const manifest = buildPush38GatewayMaintenanceIsolationManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString()
}).document;
assert.equal(item.buildSha, "04c58f24f4e207e3dab9302796f7b0edace8eca5");
assert.equal(manifest.release_id, "qa-p38-health-gateway-maintenance-isolation-995d6f822468");
assert.equal(manifest.version, "0.2.17-p38-health");
assert.equal(manifest.artifact_sha256, "995d6f822468f5a2f8b5be59d338c46ddc0d4647b28068d999a972fb13953efe");
assert.equal(manifest.artifact_size, 135797570);
assert.equal(manifest.profile, "PHYSICAL_GATEWAY");
assert.equal(manifest.compatibility.minimum_current_version, "0.2.16-p38-health");
assert.equal(manifest.compatibility.maximum_current_version, "0.2.16-p38-health");
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(item.rollbackReleaseId, "qa-p38-health-gateway-media-cadence-2abe984fa273");
assert.equal(item.supersedesReleaseId, "qa-p38-health-gateway-media-cadence-2abe984fa273");

const installer = readFileSync(new URL("./install-push38-homeqa-ota-agent.mjs", import.meta.url), "utf8");
for (const token of ["--gateway-maintenance-isolation-upgrade", item.releaseId,
  item.priorManagementReleaseId, item.priorManagementArtifactSha256,
  "functional_runtime_changed: false"])
  assert.ok(installer.includes(token), `installer missing ${token}`);
const phase = readFileSync(new URL("../../services/video-gateway/home-qa-transition-phase.mjs", import.meta.url), "utf8");
assert.ok(phase.includes(item.releaseId));
const driver = readFileSync(new URL("./drive-push38-gateway-maintenance-isolation-health.mjs", import.meta.url), "utf8");
for (const token of ["PUSH38_GATEWAY_MAINTENANCE_ISOLATION).releaseId",
  "Object.freeze([1, 2, 3, 4, 5, 6, 7, 10, 11])",
  "observed.connected === 9", "observed.failed === 1", "observed.progressing === 9"])
  assert.ok(driver.includes(token), `health driver missing ${token}`);
const activation = readFileSync(new URL("./activate-push38-homeqa-gateway-common-cause-recovery.mjs", import.meta.url), "utf8");
for (const token of ["rollout.devices !== 2", "rollout.target_release_count !== 1"])
  assert.ok(activation.includes(token),
    `activation must reconcile the exact two-device, one-target HOME_QA scope: ${token}`);
const retry = readFileSync(new URL("./retry-push38-homeqa-gateway-maintenance-isolation.mjs", import.meta.url), "utf8");
for (const token of [item.releaseId, "authorizeQuarantinedReleaseRetry",
  "prior_candidate_healthy_duration_ms", "LATE_LIVENESS_FAILURE_DURING_DEVELOPMENT_CONTENTION",
  "activeHeavyDevelopmentProcesses", "9_OF_9_SOURCE_AVAILABLE_PROGRESSING",
  "functional_runtime_changed_by_command: false"])
  assert.ok(retry.includes(token), `retry missing ${token}`);
console.log(JSON.stringify({ status: "PASS", immutable_release: true, exact_device: true,
  cohort_percent: 0, signed_rollback_preserved: true, session_maintenance_isolated: true }));
