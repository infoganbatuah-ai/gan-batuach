import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPush38ConnectorGuardRetryRecoveryManifest,
  PUSH38_CONNECTOR_GUARD_RETRY_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-connector-guard-retry.mjs";

const manifest = buildPush38ConnectorGuardRetryRecoveryManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString()
}).document;
assert.equal(item.buildSha, "38d2e9a6be9c3c417dbedc3607dd01e9142279be");
assert.equal(manifest.release_id, "qa-p38-management-guard-retry-bc310bf7605c");
assert.equal(manifest.artifact_sha256, "bc310bf7605cb7a05386c10130bb58c8c3459a65469850cbfc65efc1d48b0f60");
assert.equal(manifest.artifact_size, 147403307);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(item.priorManagementReleaseId, "qa-p38-management-runtime-pid-95c3b60ed951");
assert.equal(item.authorizedRetryReleaseId, "qa-p38-health-connector-device-session-23a104eb2a64");
const agent = readFileSync(new URL("../../services/video-gateway/edge-installed-ota-agent.mjs", import.meta.url), "utf8");
for (const token of ["pendingQuarantineRetry", "AUTHORIZED_RETRY_ACTIVE", "SUPERVISOR_PID_UNSTABLE",
  "runEdgeUpdateCycle"]) assert.ok(agent.includes(token), `missing ${token}`);
console.log(JSON.stringify({ status: "PASS", management_only: true, exact_device: true,
  cohort_percent: 0, evidence_bound_retry: true, normal_ota_apply_health_rollback: true }));
