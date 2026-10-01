import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to 0.2.42. The first live canary proved that a
// replacement can need 7.7 seconds for its first HLS output and the unchanged
// six-second/four-advance continuity proof. The prior fixed twelve-second
// probation therefore killed valid candidates before confirmation. This
// release separates bounded acquisition from bounded confirmation while
// preserving freshness, single-owner, backoff, and rollback requirements.
export const PUSH38_GATEWAY_ROUTINE_CONFIRMATION = Object.freeze({
  role: "GATEWAY_ROUTINE_CONFIRMATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-routine-confirmation-86028a0e75bf",
  version: "0.2.43-p38-health",
  buildSha: "4a55e3b9fb7dad30daaf2d1555f5fcda3cbc5a84",
  digest: "86028a0e75bf5b9135741e35904db0a6e9d5e17d877969c5b1329cb26c759e18",
  size: 135836820,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-recovery-continuity-73787e3e60ac",
  rollbackVersion: "0.2.42-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-recovery-continuity-73787e3e60ac",
  supersedesVersion: "0.2.42-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayRoutineConfirmationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_ROUTINE_CONFIRMATION;
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
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
