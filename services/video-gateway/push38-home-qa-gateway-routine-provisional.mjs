import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the first 0.2.29 metadata issuance. The artifact
// bytes are unchanged, but the release identity was re-issued after the live
// 0.2.25 runtime failed late and the signed manager restored CURRENT to the
// exact 0.2.23 KNOWN_GOOD. Compatibility and rollback therefore bind the real
// live predecessor instead of pretending the quarantined 0.2.25 is current.
// Routine finite-response handoffs may serve an advancing replacement
// provisionally while retaining the old relay for the confirmation window.
export const PUSH38_GATEWAY_ROUTINE_PROVISIONAL = Object.freeze({
  role: "GATEWAY_ROUTINE_REBASED",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-routine-rebased-6045266c007a",
  version: "0.2.30-p38-health",
  buildSha: "167ad231183ebc8487a3636e8689b5acaf92faf5",
  digest: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  size: 135816118,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-output-rescue-9934c36fe0a2",
  rollbackVersion: "0.2.23-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  supersedesVersion: "0.2.29-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayRoutineProvisionalManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_ROUTINE_PROVISIONAL_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_ROUTINE_PROVISIONAL_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_ROUTINE_PROVISIONAL_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_ROUTINE_PROVISIONAL;
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
    throw new Error("P38_GATEWAY_ROUTINE_PROVISIONAL_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
