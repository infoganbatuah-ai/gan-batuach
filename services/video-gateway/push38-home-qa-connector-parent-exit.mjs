import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable corrective Connector release built after the liveness release
// proved that the supervised parent could remain alive while asynchronous
// cleanup blocked after a media-child failure. The bounded parent-exit path
// lets launchd restart the same signed release; the existing OTA crash-loop
// policy remains the sole rollback owner.
export const PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY = Object.freeze({
  role: "CONNECTOR_PARENT_EXIT_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-parent-exit-f7dba974e80f",
  version: "0.2.14-p38-health",
  buildSha: "91569afa630610d842be70f3fed1c9e98a9f9641",
  digest: "f7dba974e80fc7e70bef0584744379b09ef4c0e8161eb13c32cea6118a4a55fd",
  size: 147393473,
  profile: "SOFTWARE_CONNECTOR"
});

export function buildPush38ConnectorParentExitRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || "")) throw new Error("P38_PARENT_EXIT_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash) throw new Error("P38_PARENT_EXIT_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_PARENT_EXIT_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY;
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
    throw new Error("P38_PARENT_EXIT_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
