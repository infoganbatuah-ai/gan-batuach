import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorRtspCadenceManifest,
  PUSH38_CONNECTOR_RTSP_CADENCE as item } from
  "../../services/video-gateway/push38-home-qa-connector-rtsp-cadence.mjs";

const document = buildPush38ConnectorRtspCadenceManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: "2026-09-28T21:00:00.000Z"
}).document;
assert.equal(item.version, "0.2.26-p38-health");
assert.equal(item.rollbackVersion, "0.2.25-p38-health");
assert.equal(item.rollbackReleaseId,
  "qa-p38-health-connector-final-stability-3a211a8ef1c2");
assert.equal(item.supersedesReleaseId, item.rollbackReleaseId);
assert.equal(item.predecessorDigest,
  "3a211a8ef1c275283194ea7a4ef93ba59e6f560b7b8cc01dca43a28d03e6f395");
assert.equal(document.artifact_sha256,
  "559bb01f78a2275f6dfc05723673250318803fbf68a8fd111f93084cbb47e02f");
assert.equal(document.artifact_size, 147410718);
assert.equal(document.rollout.cohort_percent, 0);
assert.deepEqual(document.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(document.compatibility.minimum_current_version, item.rollbackVersion);
assert.equal(document.compatibility.maximum_current_version, item.rollbackVersion);
assert.match(document.artifact_url,
  new RegExp(`/home-qa/${item.releaseId}/${item.digest}\\.tar\\.gz$`));
const issuer = readFileSync("scripts/release/issue-push38-home-qa-connector-rtsp-cadence.mjs", "utf8");
assert.match(issuer, /refs\/heads\/codex\/push-38-aws-signing/);
assert.match(issuer, /signRemoteEdgeDocument/);
assert.match(issuer, /verifyEdgeUpdateManifest/);
console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, rollback_release_id: item.rollbackReleaseId,
  cadence_ms: 480_000 }));
