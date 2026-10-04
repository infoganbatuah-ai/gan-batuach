import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable follow-up to the safely paused 0.2.16 rollout. It retains the
// RTSP and host-continuity corrections while giving the camera runtime and OTA
// agent one durable managed-device runtime identity and monotonic sequence.
// The signed 0.2.14 release remains the rollback target.
export const PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY = Object.freeze({
  role: "CONNECTOR_DEVICE_SESSION_CONTINUITY_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-device-session-23a104eb2a64",
  version: "0.2.17-p38-health",
  buildSha: "005319bf75762847ebd0c00613d82fbb469f4521",
  digest: "23a104eb2a643e9e03c995d991455f137fb583d487f377b9fb29d226312213ba",
  size: 147405865,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-parent-exit-f7dba974e80f",
  rollbackVersion: "0.2.14-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-host-continuity-8b8ec21e41c2"
});

export function buildPush38ConnectorDeviceSessionRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_DEVICE_SESSION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_DEVICE_SESSION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_DEVICE_SESSION_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY;
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
    throw new Error("P38_CONNECTOR_DEVICE_SESSION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
