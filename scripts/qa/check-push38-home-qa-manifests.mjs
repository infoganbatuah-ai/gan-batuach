import assert from "node:assert/strict";
import { buildPush38HomeQaManifests } from "../../services/video-gateway/push38-home-qa-manifests.mjs";
import { evaluateEdgeUpdateEligibility } from "../../services/video-gateway/edge-update-contract.mjs";
import { edgeReleaseObjectPath } from "../../services/video-gateway/edge-release-object.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const releases = buildPush38HomeQaManifests({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() });
assert.equal(releases.length, 3);
assert.equal(new Set(releases.map(entry => entry.role)).size, 3);
for (const { document, deviceId } of releases) {
  assert.equal(document.rollout.cohort_percent, 0);
  assert.deepEqual(document.rollout.explicit_device_ids, [deviceId]);
  assert.equal(new URL(document.artifact_url).pathname,
    `/digital-observer-releases/${edgeReleaseObjectPath(document)}`);
  const device = { deviceId, profile: document.profile, platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 1, revoked: false };
  assert.equal(evaluateEdgeUpdateEligibility(document, device).eligible, true);
  for (const wrong of [
    { deviceId: "00000000-0000-4000-8000-000000000000" }, { profile: "ENTERPRISE_EDGE" },
    { architecture: "x64" }, { channel: "INTERNAL" }, { revoked: true }
  ]) assert.equal(evaluateEdgeUpdateEligibility(document, { ...device, ...wrong }).eligible, false);
}
assert.throws(() => buildPush38HomeQaManifests({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "http://example.test", releasedAt: new Date().toISOString() }), /P38_HOME_QA_ORIGIN_INVALID/);
console.log(JSON.stringify({ result: "PASS", manifest_templates: 3, exact_targeting: true,
  negative_scope_cases: 15, live_aws_signature: "NOT_TESTED" }));
