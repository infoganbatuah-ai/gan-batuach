import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to the never-activated 0.2.33 candidate. It retains
// the reserved OUTPUT_RESCUE capacity and also preserves ffprobe's verified
// H.264 codec so the nine live DVR relays use the bounded copy path instead of
// unnecessary software/hardware transcoding. Signed 0.2.31 remains rollback.
export const PUSH38_GATEWAY_CODEC_PRESERVATION = Object.freeze({
  role: "GATEWAY_RESCUE_CAPACITY_CODEC_PRESERVATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-codec-preservation-f303e4226954",
  version: "0.2.35-p38-health",
  buildSha: "22f852d2a571f2f2df1abff79f0a0033e42d5e5a",
  digest: "f303e42269548d7462f077a56c77e04da11203e933d9d6e2d90adaed8465ef52",
  size: 135821029,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-probation-budget-ac185c72cf9e",
  rollbackVersion: "0.2.31-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-rescue-capacity-cedb6ebe5d18",
  supersedesVersion: "0.2.33-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayCodecPreservationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_CODEC_PRESERVATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_CODEC_PRESERVATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_CODEC_PRESERVATION_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_CODEC_PRESERVATION;
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
    throw new Error("P38_GATEWAY_CODEC_PRESERVATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
