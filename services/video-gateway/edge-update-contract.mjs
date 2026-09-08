import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";

export const EDGE_UPDATE_PROTOCOL = "observer-edge-update-v1";
export const EDGE_UPDATE_PROFILES = Object.freeze(["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"]);
export const EDGE_UPDATE_CHANNELS = Object.freeze(["INTERNAL", "CANARY", "STABLE"]);
export const EDGE_UPDATE_STATES = Object.freeze([
  "IDLE", "UPDATE_AVAILABLE", "DOWNLOADING", "VERIFYING", "STAGED", "INSTALLING", "RESTARTING",
  "VERIFYING_HEALTH", "HEALTHY", "ROLLBACK_REQUIRED", "ROLLING_BACK", "ROLLED_BACK", "UPDATE_FAILED"
]);
export const EDGE_ROLLOUT_STAGES = Object.freeze(["INTERNAL_QA", "CANARY", "SMALL_COHORT", "BROADER_COHORT", "GENERAL"]);

const identifier = /^[A-Za-z0-9._:-]{3,160}$/;
const sha256 = /^[a-f0-9]{64}$/;
const signature = /^[A-Za-z0-9_-]{64,256}$/;
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;
const exactManifestKeys = ["protocol", "release_id", "version", "build_sha", "channel", "platform", "architecture", "profile",
  "artifact_url", "artifact_sha256", "artifact_size", "signing_key_id", "compatibility", "released_at", "rollout", "signature"];

function fail(code) { throw Object.assign(new Error(code), { code }); }
function exactKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function boundedString(value, pattern, code) { if (typeof value !== "string" || !pattern.test(value)) fail(code); return value; }

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
  return value;
}

export function parseSemanticVersion(value) {
  const match = typeof value === "string" ? semver.exec(value) : null;
  if (!match) fail("EDGE_UPDATE_VERSION_INVALID");
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] || "" };
}

export function compareSemanticVersions(left, right) {
  const a = parseSemanticVersion(left), b = parseSemanticVersion(right);
  for (const key of ["major", "minor", "patch"]) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

export function validateEdgeUpdateManifest(input) {
  exactKeys(input, exactManifestKeys, "EDGE_UPDATE_MANIFEST_MALFORMED");
  if (input.protocol !== EDGE_UPDATE_PROTOCOL) fail("EDGE_UPDATE_PROTOCOL_UNSUPPORTED");
  boundedString(input.release_id, identifier, "EDGE_UPDATE_RELEASE_ID_INVALID");
  parseSemanticVersion(input.version);
  boundedString(input.build_sha, /^[a-f0-9]{7,64}$/, "EDGE_UPDATE_BUILD_INVALID");
  if (!EDGE_UPDATE_CHANNELS.includes(input.channel)) fail("EDGE_UPDATE_CHANNEL_INVALID");
  boundedString(input.platform, /^[a-z0-9-]{3,40}$/, "EDGE_UPDATE_PLATFORM_INVALID");
  boundedString(input.architecture, /^(arm64|x64)$/, "EDGE_UPDATE_ARCHITECTURE_INVALID");
  if (!EDGE_UPDATE_PROFILES.includes(input.profile)) fail("EDGE_UPDATE_PROFILE_INVALID");
  let artifactUrl;
  try { artifactUrl = new URL(input.artifact_url); } catch { fail("EDGE_UPDATE_ARTIFACT_URL_INVALID"); }
  if (artifactUrl.protocol !== "https:" || artifactUrl.username || artifactUrl.password || artifactUrl.hash) fail("EDGE_UPDATE_ARTIFACT_TRANSPORT_INVALID");
  boundedString(input.artifact_sha256, sha256, "EDGE_UPDATE_DIGEST_INVALID");
  if (!Number.isSafeInteger(input.artifact_size) || input.artifact_size < 1 || input.artifact_size > 2 * 1024 * 1024 * 1024) fail("EDGE_UPDATE_ARTIFACT_SIZE_INVALID");
  boundedString(input.signing_key_id, identifier, "EDGE_UPDATE_SIGNING_KEY_INVALID");
  boundedString(input.signature, signature, "EDGE_UPDATE_SIGNATURE_INVALID");
  const releasedAt = Date.parse(input.released_at);
  if (!Number.isFinite(releasedAt) || releasedAt > Date.now() + 5 * 60_000) fail("EDGE_UPDATE_RELEASE_TIME_INVALID");
  exactKeys(input.compatibility, ["minimum_current_version", "maximum_current_version", "minimum_config_version", "maximum_config_version", "security_floor_version"], "EDGE_UPDATE_COMPATIBILITY_INVALID");
  parseSemanticVersion(input.compatibility.minimum_current_version);
  if (input.compatibility.maximum_current_version !== null) parseSemanticVersion(input.compatibility.maximum_current_version);
  parseSemanticVersion(input.compatibility.security_floor_version);
  if (!Number.isInteger(input.compatibility.minimum_config_version) || input.compatibility.minimum_config_version < 1
    || !Number.isInteger(input.compatibility.maximum_config_version) || input.compatibility.maximum_config_version < input.compatibility.minimum_config_version) fail("EDGE_UPDATE_CONFIG_COMPATIBILITY_INVALID");
  exactKeys(input.rollout, ["stage", "cohort_seed", "cohort_percent", "explicit_device_ids"], "EDGE_UPDATE_ROLLOUT_INVALID");
  if (!EDGE_ROLLOUT_STAGES.includes(input.rollout.stage)) fail("EDGE_UPDATE_ROLLOUT_STAGE_INVALID");
  boundedString(input.rollout.cohort_seed, identifier, "EDGE_UPDATE_COHORT_SEED_INVALID");
  if (!Number.isInteger(input.rollout.cohort_percent) || input.rollout.cohort_percent < 0 || input.rollout.cohort_percent > 100) fail("EDGE_UPDATE_COHORT_PERCENT_INVALID");
  if (!Array.isArray(input.rollout.explicit_device_ids) || input.rollout.explicit_device_ids.length > 256
    || input.rollout.explicit_device_ids.some((value) => typeof value !== "string" || !identifier.test(value))) fail("EDGE_UPDATE_EXPLICIT_DEVICES_INVALID");
  return Object.freeze(structuredClone(input));
}

export function canonicalEdgeUpdateManifest(input) {
  const manifest = structuredClone(input);
  delete manifest.signature;
  return JSON.stringify(stable(manifest));
}

export function verifyEdgeUpdateManifest(input, trustedPublicKeys) {
  let manifest;
  try { manifest = validateEdgeUpdateManifest(input); } catch (error) { return { ok: false, reason: error.code || "EDGE_UPDATE_MANIFEST_MALFORMED" }; }
  const publicKey = trustedPublicKeys?.[manifest.signing_key_id];
  if (typeof publicKey !== "string") return { ok: false, reason: "EDGE_UPDATE_SIGNING_KEY_UNTRUSTED" };
  try {
    const valid = verify(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), createPublicKey({
      key: Buffer.from(publicKey, "base64url"), format: "der", type: "spki"
    }), Buffer.from(manifest.signature, "base64url"));
    return valid ? { ok: true, manifest } : { ok: false, reason: "EDGE_UPDATE_SIGNATURE_INVALID" };
  } catch { return { ok: false, reason: "EDGE_UPDATE_SIGNING_KEY_INVALID" }; }
}

export function edgeArtifactDigest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function verifyEdgeArtifact(bytes, manifest) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) return { ok: false, reason: "EDGE_UPDATE_ARTIFACT_INVALID" };
  if (bytes.byteLength !== manifest.artifact_size) return { ok: false, reason: "EDGE_UPDATE_ARTIFACT_SIZE_MISMATCH" };
  const actual = edgeArtifactDigest(bytes), expected = manifest.artifact_sha256;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "EDGE_UPDATE_ARTIFACT_TAMPERED" };
}

export function deviceRolloutBucket(deviceId, seed) {
  boundedString(deviceId, identifier, "EDGE_UPDATE_DEVICE_ID_INVALID");
  return createHash("sha256").update(`${seed}:${deviceId}`).digest().readUInt32BE(0) % 10_000;
}

export function evaluateEdgeUpdateEligibility(manifest, device) {
  if (manifest.profile !== device.profile) return { eligible: false, reason: "EDGE_UPDATE_PROFILE_MISMATCH" };
  if (manifest.platform !== device.platform || manifest.architecture !== device.architecture) return { eligible: false, reason: "EDGE_UPDATE_PLATFORM_MISMATCH" };
  if (manifest.channel !== device.channel) return { eligible: false, reason: "EDGE_UPDATE_CHANNEL_MISMATCH" };
  if (device.revoked === true) return { eligible: false, reason: "EDGE_UPDATE_DEVICE_REVOKED" };
  if (compareSemanticVersions(device.currentVersion, manifest.compatibility.minimum_current_version) < 0
    || (manifest.compatibility.maximum_current_version && compareSemanticVersions(device.currentVersion, manifest.compatibility.maximum_current_version) > 0)) return { eligible: false, reason: "EDGE_UPDATE_RUNTIME_INCOMPATIBLE" };
  if (device.configVersion < manifest.compatibility.minimum_config_version || device.configVersion > manifest.compatibility.maximum_config_version) return { eligible: false, reason: "EDGE_UPDATE_CONFIG_INCOMPATIBLE" };
  if (compareSemanticVersions(manifest.version, manifest.compatibility.security_floor_version) < 0) return { eligible: false, reason: "EDGE_UPDATE_SECURITY_FLOOR_VIOLATION" };
  const explicit = manifest.rollout.explicit_device_ids.includes(device.deviceId);
  const included = explicit || deviceRolloutBucket(device.deviceId, manifest.rollout.cohort_seed) < manifest.rollout.cohort_percent * 100;
  return included ? { eligible: true, reason: explicit ? "EDGE_UPDATE_EXPLICIT_CANARY" : "EDGE_UPDATE_COHORT_ELIGIBLE" }
    : { eligible: false, reason: "EDGE_UPDATE_NOT_IN_COHORT" };
}

export function assertAuthorizedUpdateDirection({ currentVersion, targetVersion, knownGoodVersions, securityFloorVersion, rollback }) {
  const direction = compareSemanticVersions(targetVersion, currentVersion);
  if (direction > 0) return true;
  if (!rollback) fail("EDGE_UPDATE_DOWNGRADE_REJECTED");
  if (!knownGoodVersions.includes(targetVersion)) fail("EDGE_UPDATE_ROLLBACK_TARGET_UNTRUSTED");
  if (compareSemanticVersions(targetVersion, securityFloorVersion) < 0) fail("EDGE_UPDATE_SECURITY_FLOOR_VIOLATION");
  return true;
}

export function shouldPauseRollout({ failedCanaries, unhealthyCanaries, failureThreshold = 1 }) {
  if (![failedCanaries, unhealthyCanaries, failureThreshold].every(Number.isInteger) || failureThreshold < 1) fail("EDGE_UPDATE_ROLLOUT_COUNTER_INVALID");
  return failedCanaries + unhealthyCanaries >= failureThreshold;
}
