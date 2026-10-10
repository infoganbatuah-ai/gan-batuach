import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The failed 60-minute pre-soak proved an exclusive relay replacement could
// acquire a new DVR transport before the old FFmpeg child had actually closed.
// This exact-device successor serializes release of the old input pipe and
// process transport. Signed 0.2.77 is the exact rollback predecessor.
export const PUSH38_GATEWAY_OWNER_TRANSPORT_RELEASE = Object.freeze({
  role: "GATEWAY_OWNER_TRANSPORT_RELEASE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-owner-transport-release-41af624dacc7",
  version: "0.2.78-p38-health",
  buildSha: "b62b6c98fc15c41547282ae7ece53e8ff5cb8807",
  digest: "41af624dacc742fd2d768034991ad5340ed112e9e2ca288512af7c6efdb1c1ad",
  size: 135871385,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-device-identity-continuity-63cd90b08ec9",
  rollbackVersion: "0.2.77-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-device-identity-continuity-63cd90b08ec9",
  supersedesVersion: "0.2.77-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  failedPreSoakResultSha256: "ef8814d5c314fdf8e80ce621644933e84f3ffb955d86471eab1ee21f217fcd73",
  failedPreSoakCheckpointsSha256: "7e6934a28f68920168c30d307a7007e32313614d057fa603edb87070e71f8cbb"
});

// The 0.2.77 predecessor may retain the cumulative
// finite_response_reopen_rejected marker from the exact owner-gap failure this
// release repairs. Accept that marker only while the live recorder session is
// singular, authenticated, responsive, and the bounded source truth remains
// intact. This keeps the preflight fail-closed for a new session/auth/common-
// cause failure without requiring the predecessor to already contain the fix.
export function gatewayOwnerTransportReleaseBaselineAcceptable(sample = {}) {
  const connected = sample.connected;
  const progressing = sample.progressing;
  const expectedReasons = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  const rotationReasonAllowed = sample.rotations === 0
    ? sample.last_rotation_reason === null
    : ["proactive_nonexclusive_renewal", "finite_response_reopen_rejected"]
      .includes(sample.last_rotation_reason);
  return ["degraded", "healthy"].includes(sample.status) && sample.assigned === 10 &&
    sample.empty === 6 && Number.isInteger(connected) && connected >= 7 && connected <= 9 &&
    sample.failed === 10 - connected && Number.isInteger(progressing) &&
    progressing >= 7 && progressing <= 9 && Number.isInteger(sample.stalled) &&
    sample.stalled >= 0 && sample.stalled <= 2 && Math.max(connected, progressing) >= 8 &&
    Array.isArray(sample.reason_codes) && sample.reason_codes.every(reason => expectedReasons.has(reason)) &&
    Number.isInteger(sample.rotations) && sample.rotations >= 0 && rotationReasonAllowed &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts &&
    Number.isInteger(sample.proactive_attempts) && sample.proactive_attempts >= 0 &&
    sample.proactive_attempts <= sample.rotations &&
    sample.proactive_succeeded === sample.proactive_attempts;
}

export function buildPush38GatewayOwnerTransportReleaseManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_OWNER_TRANSPORT_RELEASE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_OWNER_TRANSPORT_RELEASE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_OWNER_TRANSPORT_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_OWNER_TRANSPORT_RELEASE;
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
    throw new Error("P38_GATEWAY_OWNER_TRANSPORT_RELEASE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
