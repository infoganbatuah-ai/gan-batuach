import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Signed management-only follow-up. An evidence-bound, one-time quarantined
// release retry may reach the normal OTA apply/health/rollback gates before a
// liveness-starved legacy HTTP probe. Functional runtime is unchanged merely
// by installing this release's management code.
export const PUSH38_CONNECTOR_GUARD_RETRY_RECOVERY = Object.freeze({
  role: "CONNECTOR_SUPERVISOR_GUARDED_RETRY_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-management-guard-retry-bc310bf7605c",
  version: "0.2.19-p38-health",
  buildSha: "38d2e9a6be9c3c417dbedc3607dd01e9142279be",
  digest: "bc310bf7605cb7a05386c10130bb58c8c3459a65469850cbfc65efc1d48b0f60",
  size: 147403307,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-parent-exit-f7dba974e80f",
  rollbackVersion: "0.2.14-p38-health",
  priorManagementReleaseId: "qa-p38-management-runtime-pid-95c3b60ed951",
  priorManagementArtifactSha256: "95c3b60ed951427d527d884af3b8d51ec2a24058a0f8b2672cdc28826d892dc3",
  authorizedRetryReleaseId: "qa-p38-health-connector-device-session-23a104eb2a64"
});

export function buildPush38ConnectorGuardRetryRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_GUARD_RETRY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_GUARD_RETRY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_GUARD_RETRY_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_GUARD_RETRY_RECOVERY;
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
    throw new Error("P38_CONNECTOR_GUARD_RETRY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
