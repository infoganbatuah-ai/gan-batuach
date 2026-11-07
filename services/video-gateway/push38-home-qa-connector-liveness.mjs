import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable corrective Connector release built from the exact candidate that
// passed all six canonical CI gates after the startup release was quarantined.
// The release adds bounded child-liveness recovery and downstream request
// cancellation; the existing OTA crash-loop policy remains the rollback owner.
export const PUSH38_CONNECTOR_LIVENESS_RECOVERY = Object.freeze({
  role: "CONNECTOR_LIVENESS_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-liveness-bb89862c6352",
  version: "0.2.13-p38-health",
  buildSha: "d40c946779264b3ead46cb15248c12bcb44a8bce",
  digest: "bb89862c63522d3014a435e46c857cb56e58d8d72949606d0ef081f8907f900f",
  size: 147396736,
  profile: "SOFTWARE_CONNECTOR"
});

export function buildPush38ConnectorLivenessRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || "")) throw new Error("P38_LIVENESS_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash) throw new Error("P38_LIVENESS_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_LIVENESS_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_LIVENESS_RECOVERY;
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: "0.1.0-legacy", maximum_current_version: null,
      minimum_config_version: 1, maximum_config_version: 9999, security_floor_version: "0.1.0-legacy" },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA", cohort_seed: "push38-home-qa-exact-device",
      cohort_percent: 0, explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_LIVENESS_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
