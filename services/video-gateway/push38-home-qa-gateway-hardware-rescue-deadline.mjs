import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";
import { gatewayEventLoopCleanupBaselineAcceptable } from
  "./push38-home-qa-gateway-event-loop-cleanup.mjs";

// The exact 0.2.79 canary proved that fresh recorder input can outlive a
// stalled VideoToolbox output. The hardware owner was correctly released, but
// the first software response consumed the generic probation window before the
// existing bounded no-output reopen. This successor changes only that first
// response deadline after hardware-output failure has already been proven.
// Promotion still requires four advances over six seconds. The failed 0.2.79
// canary is quarantined and rollback remains the signed 0.2.77 known-good.
export const PUSH38_GATEWAY_HARDWARE_RESCUE_DEADLINE = Object.freeze({
  role: "GATEWAY_HARDWARE_RESCUE_DEADLINE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-hardware-rescue-deadline-d8b7adb3f815",
  version: "0.2.80-p38-health",
  buildSha: "a4bd57769d92e8abba4a9e89d8cc762b8ef83ba6",
  digest: "d8b7adb3f815b91ae186034a6c3dabb54cebad410c3df796ae1a6f120b1f0d94",
  size: 135875494,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-device-identity-continuity-63cd90b08ec9",
  rollbackVersion: "0.2.77-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-event-loop-cleanup-rb77-83aaf23ce84e",
  supersedesVersion: "0.2.79-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  failedCanaryResultSha256: "1f45728786eb022e753ca261dcff60440dd236638b8554dc0d869f6dd1820777",
  failedCanaryCheckpointsSha256: "54d43daf62276fd643643e46b498965cf2a14acd59aec1e50053622e486855a6"
});

export const gatewayHardwareRescueDeadlineBaselineAcceptable =
  gatewayEventLoopCleanupBaselineAcceptable;

export function buildPush38GatewayHardwareRescueDeadlineManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_HARDWARE_RESCUE_DEADLINE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_HARDWARE_RESCUE_DEADLINE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_HARDWARE_RESCUE_DEADLINE_TIME_INVALID");
  const item = PUSH38_GATEWAY_HARDWARE_RESCUE_DEADLINE;
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
    throw new Error("P38_GATEWAY_HARDWARE_RESCUE_DEADLINE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
