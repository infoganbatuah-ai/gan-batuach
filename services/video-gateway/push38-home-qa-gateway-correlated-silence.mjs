import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.84 canary isolated a recorder-wide healthy-heartbeat pause:
// six sources crossed the silent-response threshold together and exact-channel
// rescue released four owners before the shared recorder recovered. This
// successor defers only that correlated case until recorder heartbeat evidence
// corroborates a common failure. Isolated and hardware-output recovery retain
// the already-qualified behavior.
export const PUSH38_GATEWAY_CORRELATED_SILENCE = Object.freeze({
  role: "GATEWAY_CORRELATED_SILENCE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-correlated-silence-879c233e40db",
  version: "0.2.85-p38-health",
  buildSha: "d005e5e913735dd3d2104b85850ef4f80807026c",
  digest: "879c233e40dbaec8a52bfc9e5f5488523e726015c78d9780e6b0b8db731faf2e",
  size: 135889333,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId:
    "qa-p38-health-gateway-silent-response-rescue-13b2b88991c0",
  rollbackVersion: "0.2.84-p38-health",
  supersedesReleaseId:
    "qa-p38-health-gateway-silent-response-rescue-13b2b88991c0",
  supersedesVersion: "0.2.84-p38-health",
  agentPredecessorReleaseId:
    "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256:
    "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  failedCanaryRunId: "push38-gateway-0.2.84-canary-20261006T2305IDT",
  failedCanaryStateSha256:
    "2c6f4e8266667a5656c32756053ed08884e5751f962023f29b7efd43c602498d",
  failedCanaryCheckpointsSha256:
    "6fa3ab95d8a73e71adee7422c42b143244918f4063202ed3c92253aa508303fd",
  failedCanaryResultSha256:
    "79ae0a846f6637bcd7e119d658702da403f2dcfc37b8bc510739fffa050fe986",
  failedCanaryRuntimeBundleSha256:
    "5a13ff24ce8899393600382e4a44da32b2847b20d8fa9b25b00fdb54368d9f44"
});

export function gatewayCorrelatedSilenceBaselineAcceptable(sample = {}) {
  return sample.status === "healthy" && sample.assigned === 10 &&
    sample.connected === 10 && sample.failed === 0 && sample.empty === 6 &&
    sample.progressing === 10 && sample.stalled === 0 &&
    Array.isArray(sample.reason_codes) && sample.reason_codes.length === 0 &&
    Number.isInteger(sample.rotations) && sample.rotations >= 0 &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts;
}

export function buildPush38GatewayCorrelatedSilenceManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_CORRELATED_SILENCE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_CORRELATED_SILENCE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) ||
    Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_CORRELATED_SILENCE_TIME_INVALID");
  const item = PUSH38_GATEWAY_CORRELATED_SILENCE;
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
    throw new Error("P38_GATEWAY_CORRELATED_SILENCE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
