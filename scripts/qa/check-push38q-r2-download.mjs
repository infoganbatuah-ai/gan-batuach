import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { authorizeHomeQaR2Download } from "../../services/video-gateway/edge-r2-download.mjs";
import { edgeReleaseScopeAllows, assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { assertAuthorizedUpdateDirection, canonicalEdgeUpdateManifest,
  evaluateEdgeUpdateEligibility, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const authorizationRoute = readFileSync(new URL("../../app/api/video-gateway/edge-updates/download/route.ts", import.meta.url), "utf8");
const postHandler = authorizationRoute.slice(authorizationRoute.indexOf("export async function POST"));
assert.ok(postHandler.indexOf("verifyGatewayDeviceAccessToken(") >= 0 &&
  postHandler.indexOf("verifyGatewayDeviceAccessToken(") < postHandler.indexOf("OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY"),
"anonymous requests must be denied before release-delivery readiness is disclosed");
assert.ok(postHandler.includes("homeQaManagedPhaseAllows({ enrollment: enrollment.data, manifest })"),
  "HOME_QA downloads must require the proven managed phase");
assert.ok(postHandler.includes("deviceId: enrollment.data.gateway_id"),
  "signed HOME_QA target is the installed component ID, not its enrollment-row ID");

const key = generateKeyPairSync("ed25519");
const keyId = "home-qa-test";
const trusted = { [keyId]: key.publicKey.export({ format: "der", type: "spki" }).toString("base64url") };
const deviceId = "home-connector-device";
const accountId = "a".repeat(32);
const digest = "b".repeat(64);
const releaseId = "home-connector-transition-v1";
const origin = `https://${accountId}.r2.cloudflarestorage.com`;
const artifactUrl = `${origin}/digital-observer-releases/home-qa/${releaseId}/${digest}.tar.gz`;
const base = { protocol: "observer-edge-update-v1", release_id: releaseId, version: "1.0.1",
  build_sha: "c".repeat(40), channel: "HOME_QA", platform: "darwin", architecture: "arm64",
  profile: "SOFTWARE_CONNECTOR", artifact_url: artifactUrl, artifact_sha256: digest,
  artifact_size: 136000000, signing_key_id: keyId,
  compatibility: { minimum_current_version: "1.0.0", maximum_current_version: null,
    minimum_config_version: 1, maximum_config_version: 1, security_floor_version: "1.0.0" },
  released_at: new Date().toISOString(), rollout: { stage: "INTERNAL_QA", cohort_seed: "home-qa-test",
    cohort_percent: 0, explicit_device_ids: [deviceId] }, signature: "" };
const signed = overrides => { const manifest = { ...structuredClone(base), ...overrides };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), key.privateKey).toString("base64url");
  return manifest; };
const manifest = signed();
const device = { deviceId, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
  channel: "HOME_QA", currentVersion: "1.0.0", configVersion: 1, revoked: false };
assert.equal(verifyEdgeUpdateManifest(manifest, trusted).ok, true);
assert.equal(edgeReleaseScopeAllows(manifest, device), true);
assert.equal(evaluateEdgeUpdateEligibility(manifest, device).eligible, true);
assert.equal(assertEdgeReleaseObjectUrl(manifest, origin), `home-qa/${releaseId}/${digest}.tar.gz`);
const grant = await authorizeHomeQaR2Download(manifest, { accountId, accessKeyId: "A".repeat(32),
  secretAccessKey: "S".repeat(64) });
const url = new URL(grant.url);
assert.equal(url.origin, origin);
assert.equal(url.pathname, new URL(artifactUrl).pathname);
assert.equal(url.searchParams.get("X-Amz-Expires"), "120");
assert.ok(url.searchParams.has("X-Amz-Signature"));
assert.ok(Date.parse(grant.expires_at) - Date.now() <= 120000);

for (const change of [ { deviceId: "another-device" }, { profile: "PHYSICAL_GATEWAY" },
  { architecture: "x64" }, { channel: "STABLE" }, { revoked: true } ])
  assert.equal(evaluateEdgeUpdateEligibility(manifest, { ...device, ...change }).eligible, false);
assert.equal(edgeReleaseScopeAllows(manifest, { ...device, deviceId: "tenant-b-device" }), false);
for (const changes of [ { artifact_sha256: "d".repeat(64) }, { artifact_url: `${origin}/digital-observer-releases/other-object` } ])
  assert.equal(verifyEdgeUpdateManifest({ ...manifest, ...changes }, trusted).ok, false);
assert.equal(verifyEdgeUpdateManifest(manifest, {}).ok, false);
assert.equal(verifyEdgeUpdateManifest(manifest, { [keyId]: "revoked" }).ok, false);
const broad = signed({ rollout: { ...base.rollout, cohort_percent: 100 } });
assert.equal(evaluateEdgeUpdateEligibility(broad, device).eligible, false);
assert.equal(edgeReleaseScopeAllows(broad, device), false);
const legacyRecovery = signed({ release_id: "qa-legacy-connector-recovery" });
assert.equal(evaluateEdgeUpdateEligibility(legacyRecovery, device).reason, "EDGE_UPDATE_LEGACY_RECOVERY_ONLY");
const wrongObject = signed({ artifact_url: `${origin}/digital-observer-releases/home-qa/${releaseId}/${"d".repeat(64)}.tar.gz` });
assert.throws(() => assertEdgeReleaseObjectUrl(wrongObject, origin), /EDGE_RELEASE_OBJECT_URL_INVALID/);
await assert.rejects(authorizeHomeQaR2Download(wrongObject, { accountId, accessKeyId: "A".repeat(32),
  secretAccessKey: "S".repeat(64) }), /EDGE_RELEASE_OBJECT_URL_INVALID/);
assert.throws(() => assertAuthorizedUpdateDirection({ currentVersion: "1.0.2", targetVersion: "1.0.1",
  knownGoodVersions: [], securityFloorVersion: "1.0.0", rollback: false }), /EDGE_UPDATE_DOWNGRADE_REJECTED/);
console.log(JSON.stringify({ result: "PASS", scope: "HOME_QA_R2_AUTHORIZATION_CORE", live: false }));
