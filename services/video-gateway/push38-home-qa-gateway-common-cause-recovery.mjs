import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable corrective Gateway release built after the first managed canary
// proved that every source-available DVR channel could lose media together
// while the shared recorder session stayed stale. Explicit authentication
// rejection still rotates immediately; corroborated heartbeat plus multi-source
// loss now permits one serialized recovery rotation. Signed 0.2.11 remains the
// rollback target.
export const PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY = Object.freeze({
  role: "GATEWAY_COMMON_CAUSE_RECOVERY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-common-cause-189e548bc104",
  version: "0.2.12-p38-health",
  buildSha: "f7d237bf3bbf7288a8b9989385fdea9051513186",
  digest: "189e548bc10428ac49615fd2e9f6da60553df24e9da960db9afe40678c15b6eb",
  size: 135788257,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-e354546bdbf8",
  rollbackVersion: "0.2.11-p38-health"
});

export function buildPush38GatewayCommonCauseRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_COMMON_CAUSE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_COMMON_CAUSE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_COMMON_CAUSE_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY;
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
    throw new Error("P38_GATEWAY_COMMON_CAUSE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
