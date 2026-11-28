import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.25 after the first live canary showed that two
// early HLS writes could precede a hard-stale replacement. The old relay stays
// authoritative through a bounded replacement probation window.
export const PUSH38_GATEWAY_HANDOFF_PROBATION = Object.freeze({
  role: "GATEWAY_HANDOFF_PROBATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-handoff-probation-60ace0737b23",
  version: "0.2.26-p38-health",
  buildSha: "06038e9a8be15bf1eb05848b9fe92ad0e295094b",
  digest: "60ace0737b23f1ec2cc47fb076dfe3003e0fa13bd79d16e8bf877b4c5b9260df",
  size: 135816947,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  rollbackVersion: "0.2.25-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  supersedesVersion: "0.2.25-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  priorManagementArtifactSha256: "a47982f4139f2d03d77acc0c6171c119a02f50c6aaaff8f24e8f138e1e838b98"
});

export function buildPush38GatewayHandoffProbationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_HANDOFF_PROBATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_HANDOFF_PROBATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_HANDOFF_PROBATION_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_HANDOFF_PROBATION;
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
    throw new Error("P38_GATEWAY_HANDOFF_PROBATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
