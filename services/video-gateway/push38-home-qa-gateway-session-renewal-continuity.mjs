import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.66 Shadow reproduced a 10.018-second playlist gap when the
// second recorder response retired at 237.446 seconds: the old four-minute
// renewal boundary left no time for scheduler jitter, Login, and first output,
// while an output-rescue acquisition competed on the old session epoch. This
// exact-device successor starts the same evidence-gated renewal at 3.5 minutes
// and serializes rescue while that refresh is pending. It does not relax HLS
// freshness, re-enable age-only churn, or add another rollback system. Signed
// live 0.2.64 remains the rollback target; 0.2.65 and 0.2.66 remain immutable
// failed-qualification history and are never activation bridges.
export const PUSH38_GATEWAY_SESSION_RENEWAL_CONTINUITY = Object.freeze({
  role: "GATEWAY_SESSION_RENEWAL_RESCUE_SERIALIZATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-renewal-rescue-89071bf49a45",
  version: "0.2.67-p38-health",
  buildSha: "7facf04268e82477b6594720b1c21a26833e388e",
  digest: "89071bf49a4579bcf827eeeb2f8529f9ac90448bef21c2298fe73f4f15a95d95",
  size: 135845919,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  rollbackVersion: "0.2.64-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  supersedesVersion: "0.2.64-p38-health",
  failedQualificationReleaseId: "qa-p38-health-gateway-session-renewal-d12d9594eefb",
  failedQualificationVersion: "0.2.66-p38-health",
  priorFailedQualificationReleaseId: "qa-p38-health-gateway-owner-recovery-eba5eebec6bc",
  priorFailedQualificationVersion: "0.2.65-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewaySessionRenewalContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_SESSION_RENEWAL_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_SESSION_RENEWAL_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_SESSION_RENEWAL_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_SESSION_RENEWAL_CONTINUITY;
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
    throw new Error("P38_GATEWAY_SESSION_RENEWAL_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
