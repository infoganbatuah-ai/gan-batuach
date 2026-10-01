import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to the signed 0.2.46 known-good runtime. The failed
// 60-minute pre-soak and the real-DVR shadows proved that the recorder pauses
// output before a finite response ends. Waiting six seconds to start a bounded
// rescue can cross the ten-second HLS freshness boundary. The measured rescue
// candidate acquires media within 3.97 seconds, so this release starts the same
// single-owner rescue at five seconds while keeping the ten-second freshness
// contract unchanged. A contained candidate rejection now receives a one-minute
// retry backoff while the original owner remains current; hard-stale media
// bypasses that delay. Canonical ownership still requires four advances across
// six seconds. The signed 0.2.46 runtime remains the rollback target.
export const PUSH38_GATEWAY_ROUTINE_CONFIRMATION = Object.freeze({
  role: "GATEWAY_FRESHNESS_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-rescue-backoff-52ada54c94f6",
  version: "0.2.52-p38-health",
  buildSha: "a0876ef06c920427cd04e6b136b1ef9e20362382",
  digest: "52ada54c94f65e9d20874d70d65edf193f8a543392164e6c72468eecea4c8359",
  size: 135839502,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-routine-confirmation-5cdf47d35b44",
  rollbackVersion: "0.2.46-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-freshness-continuity-6bfd6f957cd2",
  supersedesVersion: "0.2.51-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

// The long-running 0.2.41 predecessor renews its single recorder session
// proactively. A cumulative rotation count greater than zero is therefore not
// a failure by itself. Preflight may accept it only when every observed
// rotation is the expected successful non-exclusive renewal and the current
// session remains singular, authenticated, and responsive.
export function gatewayRoutineConfirmationBaselineSessionAcceptable(sample = {}) {
  return Number.isInteger(sample.rotations) && sample.rotations >= 0 &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts &&
    (sample.rotations === 0
      ? sample.last_rotation_reason === null && sample.proactive_attempts === 0 &&
        sample.proactive_succeeded === 0
      : sample.last_rotation_reason === "proactive_nonexclusive_renewal" &&
        sample.proactive_attempts === sample.rotations &&
        sample.proactive_succeeded === sample.rotations);
}

export function gatewayRoutineConfirmationLegacyRuntimeAcceptable(sample = {}) {
  const connected = sample.connected;
  const progressing = sample.progressing;
  const failed = sample.failed;
  const expectedReasons = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  return ["degraded", "healthy"].includes(sample.status) && sample.assigned === 10 &&
    sample.empty === 6 && Number.isInteger(connected) && connected >= 7 && connected <= 9 &&
    failed === 10 - connected && Number.isInteger(progressing) && progressing >= 7 && progressing <= 9 &&
    Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
    Math.max(connected, progressing) >= 8 && Array.isArray(sample.reason_codes) &&
    sample.reason_codes.every(reason => expectedReasons.has(reason)) &&
    gatewayRoutineConfirmationBaselineSessionAcceptable(sample);
}

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
