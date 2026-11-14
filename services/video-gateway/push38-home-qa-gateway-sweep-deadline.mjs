import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to 0.2.39. Nine finite DVR responses can begin in a
// synchronized cohort, so the serialized routine lane starts from an explicit
// deadline while one independently bounded lane remains available for output
// rescue. The stale boundary, signed rollback, and sole serving owner remain
// unchanged.
export const PUSH38_GATEWAY_SWEEP_DEADLINE = Object.freeze({
  role: "GATEWAY_SWEEP_DEADLINE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-sweep-deadline-f2490d2f0046",
  version: "0.2.40-p38-health",
  buildSha: "29ca4057f5030452b14f085fe207242b98696b8f",
  digest: "f2490d2f0046c966cbe5731b69a892470c584f4ba5d842e067148f4bd0eaaa1f",
  size: 135834223,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-handoff-owner-continuity-3b8ed2c5d11e",
  rollbackVersion: "0.2.39-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-handoff-owner-continuity-3b8ed2c5d11e",
  supersedesVersion: "0.2.39-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewaySweepDeadlineManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_SWEEP_DEADLINE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_SWEEP_DEADLINE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_SWEEP_DEADLINE_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_SWEEP_DEADLINE;
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
    throw new Error("P38_GATEWAY_SWEEP_DEADLINE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
