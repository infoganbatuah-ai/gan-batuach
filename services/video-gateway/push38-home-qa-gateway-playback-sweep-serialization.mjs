import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.68 one-channel Shadow proved that proactive exclusive
// renewal itself is bounded, but also captured one playback request in the
// interval after the recorder session epoch advanced and before the canonical
// session-sweep handoff marker existed. The request incorrectly entered the
// ordinary stale-recovery lane, so 0.2.68 remains failed qualification history.
// This successor retains the still-progressing prior-epoch owner for that
// exact bounded interval and leaves replacement to SESSION_SWEEP_EXCLUSIVE.
// Signed 0.2.64 remains the only activation and rollback predecessor.
export const PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION = Object.freeze({
  role: "GATEWAY_PLAYBACK_SESSION_SWEEP_SERIALIZATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-playback-sweep-a3d66994bb01",
  version: "0.2.69-p38-health",
  buildSha: "bc6cdbc26fbc55fc3ff0927bb5dba96ea9420727",
  digest: "a3d66994bb014c94c8915c71bc179b40505ab3fd664e3f054b3d4e8a3f4e4fc7",
  size: 135863386,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  rollbackVersion: "0.2.64-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  supersedesVersion: "0.2.64-p38-health",
  failedShadowReleaseId: "qa-p38-health-gateway-proactive-exclusive-322642bf9294",
  failedShadowVersion: "0.2.68-p38-health",
  failedLiveReleaseId: "qa-p38-health-gateway-renewal-rescue-89071bf49a45",
  failedLiveVersion: "0.2.67-p38-health",
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
