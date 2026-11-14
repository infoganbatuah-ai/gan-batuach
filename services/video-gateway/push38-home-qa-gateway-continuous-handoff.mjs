import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the rejected 0.2.27 candidate. Output-rescue
// probation no longer monopolizes the per-channel warmup slot, so finite DVR
// responses can chain into a verified successor without a request-time gap.
export const PUSH38_GATEWAY_CONTINUOUS_HANDOFF = Object.freeze({
  role: "GATEWAY_CONTINUOUS_HANDOFF",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-continuous-handoff-0337991da88c",
  version: "0.2.28-p38-health",
  buildSha: "4a63f88107fc30b9002cbbcb187e3d331c5ca619",
  digest: "0337991da88ce2646518ad4e9c24ef6b535b674abdad0d77ae45a9334747ad1c",
  size: 135816556,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  rollbackVersion: "0.2.25-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-retained-fallback-8c94935aceab",
  supersedesVersion: "0.2.27-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-retained-fallback-8c94935aceab",
  priorManagementArtifactSha256: "8c94935aceab501618c4e102ddc382b37fd81c75ff46d7888e1d00164b6060b7"
});

export function buildPush38GatewayContinuousHandoffManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_CONTINUOUS_HANDOFF_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_CONTINUOUS_HANDOFF_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_CONTINUOUS_HANDOFF_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_CONTINUOUS_HANDOFF;
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
    throw new Error("P38_GATEWAY_CONTINUOUS_HANDOFF_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
