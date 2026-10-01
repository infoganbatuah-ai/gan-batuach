import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to the signed 0.2.41 known-good runtime. The signed
// 0.2.45 shadow preserved process and request availability but exposed two
// real media-continuity gaps: a finite native response waited for the noisier
// output-only stale threshold, and a fully productive routine candidate could
// be rejected when the six-second confirmation boundary fell between HLS
// writes. This release detects coincident input/output end without reviving the
// noisy output-only threshold and evaluates confirmation on every probation
// tick after the required distinct output advances.
export const PUSH38_GATEWAY_ROUTINE_CONFIRMATION = Object.freeze({
  role: "GATEWAY_ROUTINE_CONFIRMATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-routine-confirmation-5cdf47d35b44",
  version: "0.2.46-p38-health",
  buildSha: "9f51b09c6674a831bc3589547a8bebe26825691c",
  digest: "5cdf47d35b4469f6fb366a28c9837e53bd2c5c5317d17a32504e1f205b22fa1b",
  size: 135834926,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-deadline-budget-42702082e62f",
  rollbackVersion: "0.2.41-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-deadline-budget-42702082e62f",
  supersedesVersion: "0.2.41-p38-health",
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
