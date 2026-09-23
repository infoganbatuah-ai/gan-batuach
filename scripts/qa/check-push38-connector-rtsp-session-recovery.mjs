import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorRtspSessionRecoveryManifest,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-rtsp-session.mjs";

const manifest = buildPush38ConnectorRtspSessionRecoveryManifest({ signingKeyId: "fixture-release-key",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString() }).document;
assert.equal(manifest.release_id, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.releaseId);
assert.equal(manifest.artifact_sha256, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.digest);
assert.equal(manifest.artifact_size, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.size);
assert.equal(manifest.build_sha, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.buildSha);
assert.equal(manifest.compatibility.minimum_current_version,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.rollbackVersion);
assert.equal(manifest.compatibility.maximum_current_version,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.rollbackVersion);
assert.equal(manifest.compatibility.security_floor_version,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.rollbackVersion);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids,
  [PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.deviceId]);
const source = readFileSync("services/video-gateway/server.mjs", "utf8");
assert.match(source, /active_relay_verified/);
assert.match(source, /function protectedRtspInput/);
assert.doesNotMatch(source, /spawn\([^\n]+(?:source\.url|source\.rtspUrl)/);
const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
assert.match(installer, /--rtsp-session-recovery-upgrade/);
const phase = readFileSync("services/video-gateway/home-qa-transition-phase.mjs", "utf8");
assert.match(phase, new RegExp(PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.releaseId));
console.log(JSON.stringify({ result: "PASS", immutable_release: manifest.release_id,
  exact_device: true, broad_cohort_disabled: true, exact_predecessor_version: true,
  credentials_absent_from_child_argv_contract: true }));
