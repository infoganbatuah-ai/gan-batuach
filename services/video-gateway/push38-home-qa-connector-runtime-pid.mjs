import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Signed management follow-up to 0.2.17. macOS launchd owns the signed Node
// runner PID after caffeinate performs its utility handoff; workload children
// must not be interpreted as the supervised runtime. The functional runtime is
// not switched merely by installing this release's management code.
export const PUSH38_CONNECTOR_RUNTIME_PID_RECOVERY = Object.freeze({
  role: "CONNECTOR_SUPERVISOR_RUNTIME_PID_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-management-runtime-pid-95c3b60ed951",
  version: "0.2.18-p38-health",
  buildSha: "a890469c38a5bd3d1b4572a05121cef9bd6d7fce",
  digest: "95c3b60ed951427d527d884af3b8d51ec2a24058a0f8b2672cdc28826d892dc3",
  size: 147405516,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-parent-exit-f7dba974e80f",
  rollbackVersion: "0.2.14-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-device-session-23a104eb2a64"
});

export function buildPush38ConnectorRuntimePidRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_RUNTIME_PID_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_RUNTIME_PID_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_RUNTIME_PID_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_RUNTIME_PID_RECOVERY;
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
    throw new Error("P38_CONNECTOR_RUNTIME_PID_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
