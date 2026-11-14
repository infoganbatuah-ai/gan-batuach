import assert from "node:assert/strict";
import {
  buildPush38ConnectorHostContinuityRecoveryManifest,
  PUSH38_CONNECTOR_HOST_CONTINUITY_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-connector-host-continuity.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const { document } = buildPush38ConnectorHostContinuityRecoveryManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString()
});
assert.equal(document.release_id, item.releaseId);
assert.equal(document.version, "0.2.16-p38-health");
assert.equal(document.build_sha, "e0f07860146294fddb059f5d6fc47ac86c5f9e98");
assert.equal(document.artifact_sha256, item.digest);
assert.equal(document.artifact_size, item.size);
assert.equal(document.profile, "SOFTWARE_CONNECTOR");
assert.equal(document.channel, "HOME_QA");
assert.equal(document.compatibility.minimum_current_version, "0.2.14-p38-health");
assert.equal(document.compatibility.maximum_current_version, "0.2.14-p38-health");
assert.equal(document.compatibility.security_floor_version, "0.2.14-p38-health");
assert.equal(document.rollout.cohort_percent, 0);
assert.deepEqual(document.rollout.explicit_device_ids, [item.deviceId]);
assert.match(document.artifact_url, new RegExp(`/home-qa/${item.releaseId}/${item.digest}\\.tar\\.gz$`));
assert.throws(() => buildPush38ConnectorHostContinuityRecoveryManifest({ signingKeyId: "bad key",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }), /SIGNER_INVALID/);
assert.throws(() => buildPush38ConnectorHostContinuityRecoveryManifest({ signingKeyId: "valid-key",
  artifactOrigin: "http://example.test", releasedAt: new Date().toISOString() }), /ORIGIN_INVALID/);
console.log(JSON.stringify({ result: "PASS", release_id: item.releaseId,
  exact_device: true, broad_cohort: false, rollback: item.rollbackReleaseId }));
