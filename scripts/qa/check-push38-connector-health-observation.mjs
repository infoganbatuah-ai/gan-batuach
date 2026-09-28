import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorHealthObservationManifest,
  PUSH38_CONNECTOR_HEALTH_OBSERVATION_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-connector-health-observation.mjs";

const manifest = buildPush38ConnectorHealthObservationManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: "2026-09-28T00:00:00.000Z"
}).document;
assert.equal(item.version, "0.2.24-p38-health");
assert.equal(item.buildSha, "acbcfe8e0ebfec66fb4389fc22e7fc4b2465d115");
assert.equal(item.rollbackVersion, "0.2.20-p38-health");
assert.equal(manifest.release_id, item.releaseId);
assert.equal(manifest.artifact_sha256, item.digest);
assert.equal(manifest.artifact_size, item.size);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.equal(manifest.compatibility.minimum_current_version, item.rollbackVersion);
assert.equal(manifest.compatibility.maximum_current_version, item.rollbackVersion);
assert.match(readFileSync("services/video-gateway/edge-crash-loop-guard.mjs", "utf8"),
  /unhealthy_observations/);
assert.match(readFileSync("services/video-gateway/edge-crash-loop-guard.mjs", "utf8"),
  /last_unhealthy_at/);
assert.match(readFileSync("scripts/qa/check-edge-runtime-liveness.mjs", "utf8"),
  /sparse probe misses/i);
for (const path of [
  "scripts/release/publish-push38-connector-pidfix-r2.mjs",
  "scripts/qa/register-push38-homeqa-connector-rtsp-session.mjs",
  "scripts/qa/preflight-push38-homeqa-connector-liveness-agent.mjs",
  "scripts/qa/install-push38-homeqa-ota-agent.mjs",
  "scripts/qa/activate-push38-homeqa-connector-rtsp-session.mjs"
]) assert.match(readFileSync(path, "utf8"), /health-observation/);
console.log(JSON.stringify({ result: "PASS", release_id: item.releaseId,
  repeated_health_observations: true, rollback_target: item.rollbackReleaseId }));
