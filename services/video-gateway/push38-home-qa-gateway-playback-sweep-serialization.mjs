import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.71 Shadow proved exact health and ownership continuity through
// two exclusive session renewals, then exposed the remaining playback truth:
// the recorder needs about 4.4 seconds to publish replacement media while the
// Product player kept only two one-second segments behind live. This successor
// advertises and consumes a six-segment HLS holdback inside the existing
// twelve-segment ring. Source freshness and ownership deadlines are unchanged;
// the buffer is accepted only during the exact retained-HLS renewal state.
// Signed 0.2.69 remains the exact live activation and rollback predecessor;
// failed 0.2.70 and 0.2.71 stay historical and ineligible.
export const PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION = Object.freeze({
  role: "GATEWAY_SESSION_SWEEP_BUFFERED_HLS_PLAYBACK_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-buffered-hls-266a9625c785",
  version: "0.2.72-p38-health",
  buildSha: "8e4b40b1f0c31448ea0b496a0af1bcb5b90fec85",
  digest: "266a9625c78586d289a17fb014e8e42201bbbac75e797da4abe38f857a5f83c3",
  size: 135865907,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-playback-sweep-a3d66994bb01",
  rollbackVersion: "0.2.69-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-playback-sweep-a3d66994bb01",
  supersedesVersion: "0.2.69-p38-health",
  failedShadowReleaseId: "qa-p38-health-gateway-retained-hls-health-1fc0a19c3fd7",
  failedShadowVersion: "0.2.71-p38-health",
  priorFailedShadowReleaseId: "qa-p38-health-gateway-retained-hls-35df17e86316",
  priorFailedShadowVersion: "0.2.70-p38-health",
  failedLiveReleaseId: "qa-p38-health-gateway-playback-sweep-a3d66994bb01",
  failedLiveVersion: "0.2.69-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayPlaybackSweepSerializationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION;
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: 1,
      maximum_config_version: 1, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
