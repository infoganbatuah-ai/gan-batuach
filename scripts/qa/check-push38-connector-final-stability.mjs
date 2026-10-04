import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorFinalStabilityManifest,
  PUSH38_CONNECTOR_FINAL_STABILITY as item } from
  "../../services/video-gateway/push38-home-qa-connector-final-stability.mjs";

const document = buildPush38ConnectorFinalStabilityManifest({
  signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: "2026-09-28T21:00:00.000Z"
}).document;
assert.equal(item.version, "0.2.25-p38-health");
assert.equal(item.rollbackVersion, "0.2.20-p38-health");
assert.equal(item.supersedesReleaseId,
  "qa-p38-health-connector-observed-health-3a211a8ef1c2");
assert.equal(document.artifact_sha256,
  "3a211a8ef1c275283194ea7a4ef93ba59e6f560b7b8cc01dca43a28d03e6f395");
assert.equal(document.artifact_size, 147411450);
assert.equal(document.rollout.cohort_percent, 0);
assert.deepEqual(document.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(document.compatibility.minimum_current_version, item.rollbackVersion);
assert.equal(document.compatibility.maximum_current_version, item.rollbackVersion);
assert.match(document.artifact_url,
  new RegExp(`/home-qa/${item.releaseId}/${item.digest}\\.tar\\.gz$`));
const issuer = readFileSync("scripts/release/issue-push38-home-qa-connector-final-stability.mjs", "utf8");
assert.match(issuer, /refs\/heads\/codex\/push-38-aws-signing/);
assert.match(issuer, /signRemoteEdgeDocument/);
assert.match(issuer, /verifyEdgeUpdateManifest/);
console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, artifact_reused_without_mutation: true,
  rollback_release_id: item.rollbackReleaseId }));
