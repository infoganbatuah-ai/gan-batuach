import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.82 pre-soak proved a bounded all-channel finite-response
// renewal with retained HLS playback continuity. The media remained available,
// but aggregate /health incorrectly promoted source-level RENEWING state to a
// component-level recovering state. This exact-device successor separates the
// two without changing relay ownership, source truth, identity, or rollback.
export const PUSH38_GATEWAY_HEALTH_CONTINUITY = Object.freeze({
  role: "GATEWAY_HEALTH_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-renewal-health-continuity-5da1976c4676",
  version: "0.2.83-p38-health",
  buildSha: "1298531e88653eb10bf05d5cd1c7e03f78f3b7e2",
  digest: "5da1976c46767ac911fad1ebb699d8588c9bef0834ded5b0013100774493dd8c",
  size: 135890717,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId:
    "qa-p38-health-gateway-finite-response-recovery-aa3d561da937",
  rollbackVersion: "0.2.82-p38-health",
  supersedesReleaseId:
    "qa-p38-health-gateway-finite-response-recovery-aa3d561da937",
  supersedesVersion: "0.2.82-p38-health",
  agentPredecessorReleaseId:
    "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256:
    "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  failedPreSoakStateSha256:
    "62b4697fcafd01846ce922c76e9f8ae41596865cec9b9754f558254503bfb6f1",
  failedPreSoakCheckpointsSha256:
    "7c7401b8bdab628b7467a58e69a5390c198a393eb9dfa9de601d2925c3837c1c"
});

export function gatewayHealthContinuityBaselineAcceptable(sample = {}) {
  return sample.status === "healthy" && sample.assigned === 10 &&
    sample.connected === 10 && sample.failed === 0 && sample.empty === 6 &&
    sample.progressing === 10 && sample.stalled === 0 &&
    Array.isArray(sample.reason_codes) && sample.reason_codes.length === 0 &&
    Number.isInteger(sample.rotations) && sample.rotations >= 0 &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts;
}

export function buildPush38GatewayHealthContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_HEALTH_CONTINUITY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_HEALTH_CONTINUITY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) ||
    Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_HEALTH_CONTINUITY_TIME_INVALID");
  const item = PUSH38_GATEWAY_HEALTH_CONTINUITY;
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
    throw new Error("P38_GATEWAY_HEALTH_CONTINUITY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
