import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable replacement for the consumed 0.2.17 attempt. This package keeps
// the device-session and protected-RTSP changes, moves expensive readiness
// probes off the HTTP event loop, and requires continuous liveness loss before
// the supervisor restarts the child. The signed 0.2.14 release remains rollback.
export const PUSH38_CONNECTOR_LIVENESS_CONTINUITY = Object.freeze({
  role: "CONNECTOR_LIVENESS_CONTINUITY_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-liveness-continuity-6efc70f798aa",
  version: "0.2.20-p38-health",
  buildSha: "2840a593b84a12d35d9f85144c64b1efbf637228",
  digest: "6efc70f798aad884f235ba5637bccf36bc4f1b2d71ada25e5b84e1c6f7b1d9ea",
  size: 147402257,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-parent-exit-f7dba974e80f",
  rollbackVersion: "0.2.14-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-device-session-23a104eb2a64"
});

export function buildPush38ConnectorLivenessContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_LIVENESS_CONTINUITY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_LIVENESS_CONTINUITY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_LIVENESS_CONTINUITY_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_LIVENESS_CONTINUITY;
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
    throw new Error("P38_CONNECTOR_LIVENESS_CONTINUITY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
