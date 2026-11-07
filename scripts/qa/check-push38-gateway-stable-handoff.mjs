import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38GatewayStableHandoffManifest,
  PUSH38_GATEWAY_STABLE_HANDOFF as item
} from "../../services/video-gateway/push38-home-qa-gateway-stable-handoff.mjs";

const manifest = buildPush38GatewayStableHandoffManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString()
}).document;
assert.equal(item.buildSha, "a7bd4c75118e7b6df0f2ea49668fa13deb493cbc");
assert.equal(manifest.release_id, "qa-p38-health-gateway-stable-handoff-afc7339384bb");
assert.equal(manifest.version, "0.2.15-p38-health");
assert.equal(manifest.artifact_sha256, "afc7339384bb93a413ac3e66368382c22ce4e3377ee40dd0b8852583e5cc515e");
assert.equal(manifest.artifact_size, 135796688);
assert.equal(manifest.profile, "PHYSICAL_GATEWAY");
assert.equal(manifest.compatibility.minimum_current_version, "0.2.14-p38-health");
assert.equal(manifest.compatibility.maximum_current_version, "0.2.14-p38-health");
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(item.rollbackReleaseId, "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58");
assert.equal(item.supersedesReleaseId, item.rollbackReleaseId);

const installer = readFileSync(new URL("./install-push38-homeqa-ota-agent.mjs", import.meta.url), "utf8");
for (const token of ["--gateway-stable-handoff-upgrade", item.releaseId,
  item.priorManagementReleaseId, item.priorManagementArtifactSha256,
  "functional_runtime_changed: false"])
  assert.ok(installer.includes(token), `installer missing ${token}`);
const phase = readFileSync(new URL("../../services/video-gateway/home-qa-transition-phase.mjs", import.meta.url), "utf8");
assert.ok(phase.includes(item.releaseId));
const driver = readFileSync(new URL("./drive-push38-gateway-stable-handoff-health.mjs", import.meta.url), "utf8");
for (const token of ["PUSH38_GATEWAY_STABLE_HANDOFF.releaseId",
  "Object.freeze([1, 2, 3, 4, 5, 6, 7, 10, 11])",
  "observed.connected === 9", "observed.failed === 1", "observed.progressing === 9"])
  assert.ok(driver.includes(token), `health driver missing ${token}`);
console.log(JSON.stringify({ status: "PASS", immutable_release: true, exact_device: true,
  cohort_percent: 0, current_rollback_preserved: true, stable_recovery_window: true }));
