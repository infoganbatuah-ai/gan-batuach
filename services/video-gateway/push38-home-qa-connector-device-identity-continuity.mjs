import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The live Connector OTA agent already owns the protected managed Ed25519
// identity, while the functional 0.2.26 runtime still falls back to the stale
// Product credential. This exact-device successor lets the runtime use the
// existing protected Connector identity store without copying or exporting a
// private key. Signed 0.2.26 remains the only compatibility and rollback base;
// the unpromoted 0.2.35 rollout is superseded and remains historical only.
export const PUSH38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY = Object.freeze({
  role: "CONNECTOR_DEVICE_IDENTITY_CONTINUITY_FROM_KNOWN_GOOD",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-device-identity-continuity-c439a2c097bc",
  version: "0.2.36-p38-health",
  buildSha: "44b238ed7e7e68f34ac2984b6f8291f88f04cdec",
  digest: "c439a2c097bccdd7238512b052d7c072962a5cd36cc7811c7d77b0cc43bc6b80",
  size: 147488860,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-rtsp-cadence-559bb01f78a2",
  rollbackVersion: "0.2.26-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-handoff-continuity-3dd81d72a040",
  predecessorDigest: "3dd81d72a04000de7e0f49615f4466b8ae5e9e80bb080485dcb8d059715a1b8a",
  agentPredecessorReleaseId: "qa-p38-health-connector-observed-health-3a211a8ef1c2",
  agentPredecessorDigest: "3a211a8ef1c275283194ea7a4ef93ba59e6f560b7b8cc01dca43a28d03e6f395"
});

export function buildPush38ConnectorDeviceIdentityContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY;
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: 4,
      maximum_config_version: 4, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
