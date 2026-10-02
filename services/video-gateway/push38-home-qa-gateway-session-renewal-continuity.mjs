import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The live 0.2.64 runtime and the signed 0.2.65 Shadow both proved that the
// owned recorder's Login session has a hard lifetime of roughly five minutes:
// Heartbeat remains successful until expiry, then every media response tied to
// the old token closes. Reactive renewal consequently creates a real playback
// gap even though authentication, the DVR and the Gateway process are healthy.
// This exact-device successor renews a proven non-exclusive session at the
// existing four-minute boundary and drains each progressing relay through the
// existing SESSION_SWEEP handoff. It does not re-enable age-only relay churn,
// change freshness thresholds, or add another rollback implementation. The
// signed live 0.2.64 release remains the exact rollback target; 0.2.65 remains
// immutable failed-qualification history and is never an activation bridge.
export const PUSH38_GATEWAY_SESSION_RENEWAL_CONTINUITY = Object.freeze({
  role: "GATEWAY_SESSION_RENEWAL_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-session-renewal-d12d9594eefb",
  version: "0.2.66-p38-health",
  buildSha: "60f831f4c46a3b118b2ce470eeb3826798e9de08",
  digest: "d12d9594eefbb88183bf58a5991a7c515f165328cdde53339b75a1432958b0cc",
  size: 135845414,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  rollbackVersion: "0.2.64-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  supersedesVersion: "0.2.64-p38-health",
  failedQualificationReleaseId: "qa-p38-health-gateway-owner-recovery-eba5eebec6bc",
  failedQualificationVersion: "0.2.65-p38-health",
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
