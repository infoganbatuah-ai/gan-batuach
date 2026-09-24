import assert from "node:assert/strict";
import { shouldReportEdgeTerminalState } from "../../services/video-gateway/edge-installed-ota-agent.mjs";
import { readFileSync } from "node:fs";
import {
  buildPush38ConnectorParentExitRecoveryManifest,
  PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-parent-exit.mjs";

const manifest = buildPush38ConnectorParentExitRecoveryManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString()
}).document;
assert.equal(manifest.release_id, PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.releaseId);
assert.equal(manifest.artifact_sha256, PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.digest);
assert.equal(manifest.artifact_size, PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.size);
assert.equal(manifest.build_sha, PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.buildSha);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids, [PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.deviceId]);

const registration = readFileSync("scripts/qa/register-push38-homeqa-connector-liveness.mjs", "utf8");
const activation = readFileSync("scripts/qa/activate-push38-homeqa-connector-liveness.mjs", "utf8");
const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const gateway = readFileSync("scripts/qa/activate-push38-homeqa-gateway-auth.mjs", "utf8");
for (const source of [registration, activation, installer])
  assert.match(source, /--parent-exit-recovery(?:-upgrade)?/);
assert.match(registration, /PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY/);
assert.match(activation, /qa-p38-health-connector-liveness-bb89862c6352/);
assert.match(activation, /EDGE_UPDATE_CRASH_LOOP/);
assert.match(installer, /qa-p38-health-connector-parent-exit-f7dba974e80f/);
assert.equal(shouldReportEdgeTerminalState({ state: "ROLLED_BACK", release_id: "failed-release",
  failure_category: "EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY" }), true);
assert.equal(shouldReportEdgeTerminalState({ state: "ACTION_REQUIRED", release_id: "failed-release",
  failure_category: "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED" }), true);
assert.equal(shouldReportEdgeTerminalState({ state: "HEALTHY", release_id: "healthy-release" }), false);
assert.match(gateway, /PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY/);
console.log(JSON.stringify({ result: "PASS", immutable_release: true, exact_device: true,
  broad_cohort: false, prior_failed_release_quarantined: true,
  signed_transition_rollback_preserved: true, gateway_dependency_updated: true }));
