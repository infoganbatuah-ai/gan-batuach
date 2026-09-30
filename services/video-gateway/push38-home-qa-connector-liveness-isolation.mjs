import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to the live signed 0.2.26 known-good. Live sampling
// proved that synchronous enumeration of the shared macOS temporary directory
// could stall the Connector event loop long enough to trigger OTA liveness
// rollback. This release confines event workspaces to a private bounded root.
export const PUSH38_CONNECTOR_LIVENESS_ISOLATION = Object.freeze({
  role: "CONNECTOR_LIVENESS_ISOLATION_FROM_KNOWN_GOOD",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-liveness-isolation-e46f2cb0daf6",
  version: "0.2.32-p38-health",
  buildSha: "82a871d544beadff6fec223fb5e815f4825afa33",
  digest: "e46f2cb0daf617cc80a5b8c2be1f448820ab391667992d390ab63de36afd1e53",
  size: 147445754,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-rtsp-cadence-559bb01f78a2",
  rollbackVersion: "0.2.26-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-generic-rtsp-a241029690ae",
  predecessorDigest: "a241029690ae7b59524f46ab557eaefdfb3553e77142f0e7619736eb77f667e7",
  agentPredecessorReleaseId: "qa-p38-health-connector-observed-health-3a211a8ef1c2",
  agentPredecessorDigest: "3a211a8ef1c275283194ea7a4ef93ba59e6f560b7b8cc01dca43a28d03e6f395"
});

export function buildPush38ConnectorLivenessIsolationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_LIVENESS_ISOLATION;
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
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
