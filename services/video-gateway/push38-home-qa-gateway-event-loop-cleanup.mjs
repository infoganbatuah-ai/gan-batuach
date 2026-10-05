import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// V8 on signed 0.2.78 proved that recursive HLS-generation cleanup could run
// synchronously on the Gateway event loop after concurrent failed handoffs.
// This exact-device successor moves runtime cleanup to the bounded serialized
// asynchronous cleanup queue. Signed 0.2.78 remains the exact rollback target.
export const PUSH38_GATEWAY_EVENT_LOOP_CLEANUP = Object.freeze({
  role: "GATEWAY_EVENT_LOOP_CLEANUP",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-event-loop-cleanup-83aaf23ce84e",
  version: "0.2.79-p38-health",
  buildSha: "cf279d83d3ebc1f685da8bf7d82c0fb13fb89d13",
  digest: "83aaf23ce84efa3c66c9d306592cd010839a7c0d8e3c5d9bc9642d68d72908cd",
  size: 135873321,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-owner-transport-release-41af624dacc7",
  rollbackVersion: "0.2.78-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-owner-transport-release-41af624dacc7",
  supersedesVersion: "0.2.78-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  failedV8ResultSha256: "71d2254ff653544725682f92db306c1184f9819d1c566c3185b1f68687cbe1fd",
  failedV8CheckpointsSha256: "ededad06a090463f6a224fc7288062e64e1ab8a35911f42794860b4e4f29c768"
});

// Accept only the exact bounded physical-source truth already qualified for
// signed 0.2.78. The predecessor may be degraded for the one known upstream
// DVR channel, but auth/session integrity and a singular recorder session must
// remain intact before this liveness-only successor can be activated.
export function gatewayEventLoopCleanupBaselineAcceptable(sample = {}) {
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

export function buildPush38GatewayEventLoopCleanupManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_EVENT_LOOP_CLEANUP_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_EVENT_LOOP_CLEANUP_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_EVENT_LOOP_CLEANUP_TIME_INVALID");
  const item = PUSH38_GATEWAY_EVENT_LOOP_CLEANUP;
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
    throw new Error("P38_GATEWAY_EVENT_LOOP_CLEANUP_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
