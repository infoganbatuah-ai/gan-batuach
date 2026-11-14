import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable replacement for the unactivated 0.2.23 manifest that assumed
// 0.2.22 would remain current. The live agent later quarantined 0.2.22 after
// an hour-long crash-loop observation and recovered the signed 0.2.20
// known-good. This release keeps the exact qualified 0.2.23 artifact bytes but
// binds installation and rollback to the actually verified 0.2.20 state.
export const PUSH38_CONNECTOR_RTSP_HANDOFF_RECOVERY = Object.freeze({
  role: "CONNECTOR_RTSP_HANDOFF_RECOVERY_FROM_KNOWN_GOOD",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-rtsp-handoff-kg20-448381dc3792",
  version: "0.2.23-p38-health",
  buildSha: "a5c3dc51a7f4e3d6bc4a8cbb2d585a85a6e31fa7",
  digest: "448381dc3792dfed37a3e98ddf73b71f5dea1ef8d4119818071e5ed03ede348b",
  size: 147408131,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-liveness-continuity-6efc70f798aa",
  rollbackVersion: "0.2.20-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-rtsp-handoff-448381dc3792"
});

export function buildPush38ConnectorRtspHandoffManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_RTSP_HANDOFF_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_RTSP_HANDOFF_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_RTSP_HANDOFF_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_RTSP_HANDOFF_RECOVERY;
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
    throw new Error("P38_CONNECTOR_RTSP_HANDOFF_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
