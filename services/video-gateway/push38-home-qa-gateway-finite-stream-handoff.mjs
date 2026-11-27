import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable follow-up to the quarantined 0.2.12 release. The real DVR proof
// showed a finite non-exclusive login lifetime followed by synchronized relay
// loss. This release renews before that boundary and hands the eight available
// streams over one at a time. Signed 0.2.11 remains the rollback target.
export const PUSH38_GATEWAY_FINITE_STREAM_HANDOFF = Object.freeze({
  role: "GATEWAY_FINITE_STREAM_HANDOFF",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-finite-handoff-76781a8e0832",
  version: "0.2.13-p38-health",
  buildSha: "e085c30f81ea498f3e8465b1c80d732e592e9159",
  digest: "76781a8e08328feb154525451c5c4a26aaca43739279f9a052280758d1a02ffb",
  size: 135792398,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-e354546bdbf8",
  rollbackVersion: "0.2.11-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-common-cause-189e548bc104"
});

export function buildPush38GatewayFiniteStreamHandoffManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_FINITE_HANDOFF_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_FINITE_HANDOFF_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_FINITE_HANDOFF_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_FINITE_STREAM_HANDOFF;
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
    throw new Error("P38_GATEWAY_FINITE_HANDOFF_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
