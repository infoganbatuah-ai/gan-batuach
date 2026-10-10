import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38GatewaySupervisorRecoveryManifest,
  PUSH38_GATEWAY_SUPERVISOR_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-gateway-supervisor-recovery.mjs";

const manifest = buildPush38GatewaySupervisorRecoveryManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString()
}).document;
assert.equal(item.buildSha, "4324fa116647b456404413c4c4b4dcb254a6a022");
assert.equal(manifest.release_id, "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58");
assert.equal(manifest.version, "0.2.14-p38-health");
assert.equal(manifest.artifact_sha256, "fb68c5180b585bd6460ae3a3720d437d23a9c042ed406ab92995cb724fc88032");
assert.equal(manifest.artifact_size, 135794917);
assert.equal(manifest.profile, "PHYSICAL_GATEWAY");
assert.equal(manifest.compatibility.minimum_current_version, item.rollbackVersion);
assert.equal(manifest.compatibility.maximum_current_version, item.rollbackVersion);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(item.supersedesReleaseId, "qa-p38-health-gateway-finite-handoff-76781a8e0832");

const installer = readFileSync(new URL("./install-push38-homeqa-ota-agent.mjs", import.meta.url), "utf8");
for (const token of ["--gateway-supervisor-recovery-upgrade", item.releaseId,
  item.priorManagementReleaseId, item.priorManagementArtifactSha256,
  "functional_runtime_changed: false"])
  assert.ok(installer.includes(token), `installer missing ${token}`);
const phase = readFileSync(new URL("../../services/video-gateway/home-qa-transition-phase.mjs", import.meta.url), "utf8");
assert.ok(phase.includes(item.releaseId));
const shadow = readFileSync(new URL("./run-push38-dvr-shadow.mjs", import.meta.url), "utf8");
for (const token of ["DVR_SHADOW_SIGNED_ARTIFACT", "DVR_SHADOW_SIGNED_BUNDLE",
  "SIGNED_RELEASE_BUNDLE", "signature_verified: true", "runtime_mutation: false"])
  assert.ok(shadow.includes(token), `shadow proof missing ${token}`);
console.log(JSON.stringify({ status: "PASS", immutable_release: true, exact_device: true,
  cohort_percent: 0, management_upgrade_before_runtime: true,
  signed_artifact_shadow_bound: true, rollback_release_id: item.rollbackReleaseId }));
