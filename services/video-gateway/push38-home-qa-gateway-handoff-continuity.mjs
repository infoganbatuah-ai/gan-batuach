import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to the rejected 0.2.37 shadow candidate. Ownership
// remains with the current relay until the complete confirmation contract
// passes, while an already-progressing single candidate supplies truthful
// media continuity during that bounded handoff window.
export const PUSH38_GATEWAY_HANDOFF_CONTINUITY = Object.freeze({
  role: "GATEWAY_HANDOFF_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-handoff-continuity-2e162c13381c",
  version: "0.2.38-p38-health",
  buildSha: "1fc108964c5c8e1f6773b037be99db45c32e2dbf",
  digest: "2e162c13381cd509d3565697f0080e5e20b74be93daedf0154ad65f2289a6b11",
  size: 135826715,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-handoff-hardware-284d3c992aa4",
  rollbackVersion: "0.2.36-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-handoff-hardware-284d3c992aa4",
  supersedesVersion: "0.2.36-p38-health",
  rolloutPredecessorReleaseId: "qa-p38-health-gateway-relay-handoff-71641da1faf1",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayHandoffContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_HANDOFF_CONTINUITY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_HANDOFF_CONTINUITY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_HANDOFF_CONTINUITY_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_HANDOFF_CONTINUITY;
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
    throw new Error("P38_GATEWAY_HANDOFF_CONTINUITY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
