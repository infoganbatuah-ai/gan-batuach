import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.25. Output rescue may provisionally serve an
// advancing replacement during probation while retaining the prior relay as a
// deterministic fallback until the 20-second handoff is confirmed.
export const PUSH38_GATEWAY_RETAINED_FALLBACK = Object.freeze({
  role: "GATEWAY_RETAINED_FALLBACK",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-retained-fallback-8c94935aceab",
  version: "0.2.27-p38-health",
  buildSha: "8f380af23372a476e40e516f4b4128e149eb6ab3",
  digest: "8c94935aceab501618c4e102ddc382b37fd81c75ff46d7888e1d00164b6060b7",
  size: 135817181,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  rollbackVersion: "0.2.25-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  supersedesVersion: "0.2.25-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-handoff-probation-60ace0737b23",
  priorManagementArtifactSha256: "60ace0737b23f1ec2cc47fb076dfe3003e0fa13bd79d16e8bf877b4c5b9260df"
});

export function buildPush38GatewayRetainedFallbackManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_RETAINED_FALLBACK_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_RETAINED_FALLBACK_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_RETAINED_FALLBACK_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_RETAINED_FALLBACK;
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
    throw new Error("P38_GATEWAY_RETAINED_FALLBACK_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
