import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.83 pre-soak recorded one exact-channel owner gap when a DVR
// response remained open while both native input and rendered HLS went silent.
// This exact-device successor releases only that stranded source through the
// existing exclusive OUTPUT_RESCUE lane without rotating the shared recorder
// login or changing another source, identity, trust, or rollback boundary.
export const PUSH38_GATEWAY_SILENT_RESPONSE_RESCUE = Object.freeze({
  role: "GATEWAY_SILENT_RESPONSE_RESCUE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-silent-response-rescue-13b2b88991c0",
  version: "0.2.84-p38-health",
  buildSha: "14369e39aa73bb7f1fc12ad440ba4561342ff90e",
  digest: "13b2b88991c00ba77e91d9f30ebd3dd768d2aeed9abce4a99a818be731cda49f",
  size: 135889572,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId:
    "qa-p38-health-gateway-renewal-health-continuity-5da1976c4676",
  rollbackVersion: "0.2.83-p38-health",
  supersedesReleaseId:
    "qa-p38-health-gateway-renewal-health-continuity-5da1976c4676",
  supersedesVersion: "0.2.83-p38-health",
  agentPredecessorReleaseId:
    "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256:
    "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  failedPreSoakStateSha256:
    "9c054f2d18d8c7aaa1a60bd7ac7ddf13e74bd55c70b2910304fb6e0f00e9c3f7",
  failedPreSoakCheckpointsSha256:
    "da95a20c78a532a375dbbcd88327ab501e53fd848b6fc58022788edaa96297ee",
  failedPreSoakResultSha256:
    "626a4615a1bc7823f7d45217ed1f76a84a924e220e980efdaca574b533d90324"
});

export function gatewaySilentResponseRescueBaselineAcceptable(sample = {}) {
  return sample.status === "healthy" && sample.assigned === 10 &&
    sample.connected === 10 && sample.failed === 0 && sample.empty === 6 &&
    sample.progressing === 10 && sample.stalled === 0 &&
    Array.isArray(sample.reason_codes) && sample.reason_codes.length === 0 &&
    Number.isInteger(sample.rotations) && sample.rotations >= 0 &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts;
}
export function buildPush38GatewaySilentResponseRescueManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_SILENT_RESPONSE_RESCUE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_SILENT_RESPONSE_RESCUE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) ||
    Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_SILENT_RESPONSE_RESCUE_TIME_INVALID");
  const item = PUSH38_GATEWAY_SILENT_RESPONSE_RESCUE;
  const document = { protocol: "observer-edge-update-v1",
    release_id: item.releaseId, version: item.version, build_sha: item.buildSha,
    channel: "HOME_QA", platform: "darwin", architecture: "arm64",
    profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size,
    signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: 1,
      maximum_config_version: 1, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !==
    edgeReleaseObjectPath(document))
    throw new Error("P38_GATEWAY_SILENT_RESPONSE_RESCUE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
