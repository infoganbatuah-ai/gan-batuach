import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorLivenessContinuityManifest as build,
  PUSH38_CONNECTOR_LIVENESS_CONTINUITY as item } from "../../services/video-gateway/push38-home-qa-connector-liveness-continuity.mjs";

const manifest = build({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString() }).document;
assert.equal(manifest.release_id, item.releaseId);
assert.equal(manifest.version, "0.2.20-p38-health");
assert.equal(manifest.artifact_sha256, item.digest);
assert.equal(manifest.artifact_size, item.size);
assert.equal(manifest.build_sha, item.buildSha);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.equal(manifest.compatibility.minimum_current_version, item.rollbackVersion);
assert.equal(manifest.compatibility.maximum_current_version, item.rollbackVersion);
const readiness = readFileSync("services/video-gateway/edge-readiness.mjs", "utf8");
const watchdog = readFileSync("services/video-gateway/edge-child-liveness-watchdog.mjs", "utf8");
const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const registration = readFileSync("scripts/qa/register-push38-homeqa-connector-rtsp-session.mjs", "utf8");
const activation = readFileSync("scripts/qa/activate-push38-homeqa-connector-rtsp-session.mjs", "utf8");
assert.doesNotMatch(readiness, /spawnSync/);
assert.match(readiness, /void warmBaseReadiness\(\)/);
assert.match(watchdog, /minimumDownMs = 45_000/);
assert.match(watchdog, /LIVENESS_DEGRADED/);
for (const source of [installer, registration, activation])
  assert.match(source, /PUSH38_CONNECTOR_LIVENESS_CONTINUITY|connector-liveness-continuity/);
console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, broad_cohort: false, readiness_nonblocking: true,
  sustained_down_required: true }));
