import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { canonicalEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { verifyHomeQaReleaseForDevice } from "../../services/video-gateway/edge-home-qa-publication.mjs";

const key = generateKeyPairSync("ed25519");
const trustedPublicKeys = { "qa-home-test": key.publicKey.export({ format: "der", type: "spki" }).toString("base64url") };
const deviceId = "qa-home-connector-device";
const profile = "SOFTWARE_CONNECTOR";
const artifactOrigin = `https://${"a".repeat(32)}.r2.cloudflarestorage.com`;
const base = { protocol: "observer-edge-update-v1", release_id: "qa-home-transition-v1", version: "1.0.1",
  build_sha: "a".repeat(40), channel: "HOME_QA", platform: "darwin", architecture: "arm64", profile,
  artifact_url: `${artifactOrigin}/digital-observer-releases/home-qa/qa-home-transition-v1/${"b".repeat(64)}.tar.gz`, artifact_sha256: "b".repeat(64), artifact_size: 100,
  signing_key_id: "qa-home-test", compatibility: { minimum_current_version: "1.0.0", maximum_current_version: null,
    minimum_config_version: 1, maximum_config_version: 1, security_floor_version: "1.0.0" },
  released_at: new Date().toISOString(), rollout: { stage: "INTERNAL_QA", cohort_seed: "qa-home-test",
    cohort_percent: 0, explicit_device_ids: [deviceId] }, signature: "" };
function signed(changes = {}) {
  const manifest = { ...structuredClone(base), ...changes };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), key.privateKey).toString("base64url");
  return manifest;
}
const check = manifest => verifyHomeQaReleaseForDevice({ manifest, trustedPublicKeys, deviceId, profile, artifactOrigin });
assert.equal(check(signed()).ok, true);
assert.equal(check(signed({ rollout: { ...base.rollout, cohort_percent: 100 } })).reason, "HOME_QA_TARGET_NOT_EXACT");
assert.equal(check(signed({ rollout: { ...base.rollout, explicit_device_ids: [] } })).reason, "HOME_QA_TARGET_NOT_EXACT");
assert.equal(check(signed({ rollout: { ...base.rollout, explicit_device_ids: [deviceId, "other-device"] } })).reason, "HOME_QA_TARGET_NOT_EXACT");
assert.equal(check(signed({ artifact_url: "https://qa.invalid/transition.tar.gz" })).reason, "HOME_QA_ARTIFACT_ENDPOINT_UNAPPROVED");
assert.equal(check(signed({ artifact_url: `${artifactOrigin}/transition.tar.gz?token=secret` })).reason, "HOME_QA_ARTIFACT_ENDPOINT_UNAPPROVED");
assert.equal(check(signed({ profile: "PHYSICAL_GATEWAY" })).reason, "HOME_QA_WRONG_PROFILE");
assert.equal(check(signed({ channel: "STABLE" })).reason, "HOME_QA_WRONG_CHANNEL");
const tampered = signed(); tampered.artifact_sha256 = "c".repeat(64);
assert.equal(check(tampered).reason, "EDGE_UPDATE_SIGNATURE_INVALID");
console.log(JSON.stringify({ result: "PASS", cases: 9, scope: "HOME_QA_PUBLISH_PREFLIGHT_ONLY" }));
