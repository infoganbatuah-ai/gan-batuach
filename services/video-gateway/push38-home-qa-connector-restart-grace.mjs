import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the quarantined 0.2.21 release. It retains the relay
// backoff fix and gives the first launchd-supervised same-release restart a new
// health window without erasing crash history or weakening the three-restart
// crash-loop threshold.
export const PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY = Object.freeze({
  role: "CONNECTOR_RESTART_GRACE_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-restart-grace-34b1985a311c",
  version: "0.2.22-p38-health",
  buildSha: "c177cce7417ea09d1a59b6cd839d5853e4be87aa",
  digest: "34b1985a311ce709130331e64228477d766df227ff2da5da3789521972dfae61",
  size: 147406841,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-liveness-continuity-6efc70f798aa",
  rollbackVersion: "0.2.20-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-relay-backoff-f551947fd1ee"
});

export function buildPush38ConnectorRestartGraceManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_RESTART_GRACE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_RESTART_GRACE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_RESTART_GRACE_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY;
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
    throw new Error("P38_CONNECTOR_RESTART_GRACE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
