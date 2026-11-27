import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the live 0.2.25 known-good release. Real Home
// qualification proved that this Tapo source can end otherwise healthy RTSP
// sessions after roughly nine minutes. Renew at eight minutes through the
// already-qualified warm handoff path, leaving the prior release as rollback.
export const PUSH38_CONNECTOR_RTSP_CADENCE = Object.freeze({
  role: "CONNECTOR_RTSP_CADENCE_FROM_KNOWN_GOOD",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-rtsp-cadence-559bb01f78a2",
  version: "0.2.26-p38-health",
  buildSha: "13800362678e3c9145cf7a1dd80fc9f32eccfae9",
  digest: "559bb01f78a2275f6dfc05723673250318803fbf68a8fd111f93084cbb47e02f",
  size: 147410718,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-final-stability-3a211a8ef1c2",
  rollbackVersion: "0.2.25-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-final-stability-3a211a8ef1c2",
  predecessorDigest: "3a211a8ef1c275283194ea7a4ef93ba59e6f560b7b8cc01dca43a28d03e6f395",
  agentPredecessorReleaseId: "qa-p38-health-connector-observed-health-3a211a8ef1c2"
});

export function buildPush38ConnectorRtspCadenceManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_RTSP_CADENCE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_RTSP_CADENCE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_RTSP_CADENCE_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_RTSP_CADENCE;
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
    throw new Error("P38_CONNECTOR_RTSP_CADENCE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
