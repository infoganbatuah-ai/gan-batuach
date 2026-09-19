import assert from "node:assert/strict";
import { edgeReleaseObjectPath, assertEdgeReleaseObjectUrl, edgeReleaseScopeAllows } from "../../services/video-gateway/edge-release-object.mjs";

const release_id = "qa-home-connector-v1", artifact_sha256 = "a".repeat(64);
const accountId = "a".repeat(32), origin = `https://${accountId}.r2.cloudflarestorage.com`;
const artifact_url = `${origin}/digital-observer-releases/home-qa/${release_id}/${artifact_sha256}.tar.gz`;
const manifest = { release_id, artifact_sha256, artifact_url, profile: "SOFTWARE_CONNECTOR", platform: "darwin",
  architecture: "arm64", channel: "INTERNAL", rollout: { stage: "INTERNAL_QA", cohort_percent: 0,
    explicit_device_ids: ["home-connector-device"] } };
const device = { deviceId: "home-connector-device", profile: "SOFTWARE_CONNECTOR", platform: "darwin",
  architecture: "arm64", channel: "INTERNAL" };
assert.equal(edgeReleaseObjectPath(manifest), `home-qa/${release_id}/${artifact_sha256}.tar.gz`);
assert.equal(assertEdgeReleaseObjectUrl(manifest, accountId), edgeReleaseObjectPath(manifest));
assert.equal(edgeReleaseScopeAllows(manifest, device), true);
assert.equal(edgeReleaseScopeAllows(manifest, { ...device, deviceId: "other-device" }), false);
assert.equal(edgeReleaseScopeAllows(manifest, { ...device, profile: "PHYSICAL_GATEWAY" }), false);
assert.equal(edgeReleaseScopeAllows(manifest, { ...device, channel: "STABLE" }), false);
assert.equal(edgeReleaseScopeAllows({ ...manifest, rollout: { ...manifest.rollout, cohort_percent: 100 } }, device), false);
assert.equal(edgeReleaseScopeAllows({ ...manifest, rollout: { ...manifest.rollout,
  explicit_device_ids: [device.deviceId, "other-device"] } }, device), false);
for (const url of ["http://example.r2.cloudflarestorage.com/", `${artifact_url}?token=secret`,
  artifact_url.replace("/home-qa/", "/production/"), artifact_url.replace(origin, "https://attacker.example")]) {
  assert.throws(() => assertEdgeReleaseObjectUrl({ ...manifest, artifact_url: url }, accountId), /EDGE_RELEASE_OBJECT_URL_INVALID/);
}
console.log(JSON.stringify({ result: "PASS", scope: "PRIVATE_R2_RELEASE_OBJECT_AND_EXACT_HOME_QA" }));
