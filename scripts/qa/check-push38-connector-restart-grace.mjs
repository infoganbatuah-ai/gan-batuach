import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorRestartGraceManifest as build,
  PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-connector-restart-grace.mjs";

const manifest = build({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString() }).document;
assert.equal(manifest.release_id, item.releaseId);
assert.equal(manifest.version, "0.2.22-p38-health");
assert.equal(manifest.artifact_sha256, item.digest);
assert.equal(manifest.artifact_size, item.size);
assert.equal(manifest.build_sha, item.buildSha);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.equal(manifest.compatibility.minimum_current_version, "0.2.20-p38-health");
assert.equal(manifest.compatibility.maximum_current_version, "0.2.20-p38-health");
assert.equal(item.supersedesReleaseId, "qa-p38-health-connector-relay-backoff-f551947fd1ee");
const guard = readFileSync("services/video-gateway/edge-crash-loop-guard.mjs", "utf8");
assert.match(guard, /supervisorRestarted/);
assert.match(guard, /unhealthy_since: null/);
for (const path of ["scripts/qa/install-push38-homeqa-ota-agent.mjs",
  "scripts/qa/register-push38-homeqa-connector-rtsp-session.mjs",
  "scripts/qa/activate-push38-homeqa-connector-rtsp-session.mjs"])
  assert.match(readFileSync(path, "utf8"), /PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY|connector-restart-grace/);
console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, broad_cohort: false, rollback: item.rollbackReleaseId,
  supersedes_quarantined_release: item.supersedesReleaseId,
  supervised_restart_health_grace: true }));
