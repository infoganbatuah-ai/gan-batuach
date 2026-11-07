import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable replacement for 0.2.20. The only functional change preserves the
// bounded relay-recovery window before a stale Tapo relay is removed, so a
// playback request cannot bypass backoff and create a restart storm.
export const PUSH38_CONNECTOR_RELAY_BACKOFF_RECOVERY = Object.freeze({
  role: "CONNECTOR_RELAY_BACKOFF_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-relay-backoff-f551947fd1ee",
  version: "0.2.21-p38-health",
  buildSha: "4cc211b82848e334cedaceda785390de4ce5dfce",
  digest: "f551947fd1eedcca97a93911ba61b600be06ffab3d0453e9a218b826980ce722",
  size: 147403784,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-liveness-continuity-6efc70f798aa",
  rollbackVersion: "0.2.20-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-liveness-continuity-6efc70f798aa"
});

export function buildPush38ConnectorRelayBackoffManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_RELAY_BACKOFF_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_RELAY_BACKOFF_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_RELAY_BACKOFF_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_RELAY_BACKOFF_RECOVERY;
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
    throw new Error("P38_CONNECTOR_RELAY_BACKOFF_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
