import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.80 runtime remained healthy when the recorder endpoint was
// current. Two independently observed DHCP moves made that endpoint stale and
// caused all DVR channels to disappear while the Gateway process, host and
// recorder hardware remained healthy. This exact-device successor adds a
// hardware-identity-bound, private-subnet-only endpoint reconciliation with a
// persisted recovery journal and one clean launchd handoff. It changes no
// Site, source, channel or credential identity. Rollback remains exact 0.2.80.
export const PUSH38_GATEWAY_DVR_ENDPOINT_RECOVERY = Object.freeze({
  role: "GATEWAY_DVR_ENDPOINT_RECOVERY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-dvr-endpoint-recovery-667d1ba76d68",
  version: "0.2.81-p38-health",
  buildSha: "cb8c52181bd0a4b3c28a37e428007d2149f48121",
  digest: "667d1ba76d68ae2cba53c6042350951e12d8d84373a156fa1753963cf41d8b89",
  size: 135890934,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-hardware-rescue-deadline-d8b7adb3f815",
  rollbackVersion: "0.2.80-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-hardware-rescue-deadline-d8b7adb3f815",
  supersedesVersion: "0.2.80-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72",
  identityBindingEvidenceSha256: "0a37dfdca9804d81cb3d0ff93c802be8fa9ca8832233567d49cff88295224862",
  liveRecoveryProofSha256: "1d5e8f319265b45c75936e2acf4b11e36604fbc1dd6f36c65fb1496fbecaf7c0",
  dhcpEvidenceSha256: "48b452a31bc6ab2bd4c92527f3281f7b0db9de636a9d1a3eb5771da6bac66648"
});

export function gatewayDvrEndpointRecoveryBaselineAcceptable(sample = {}) {
  const expectedReasons = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  return ["degraded", "healthy"].includes(sample.status) && sample.assigned === 10 &&
    sample.empty === 6 && Number.isInteger(sample.connected) && sample.connected >= 8 &&
    sample.connected <= 10 && sample.failed === 10 - sample.connected &&
    Number.isInteger(sample.progressing) && sample.progressing >= 8 && sample.progressing <= 10 &&
    Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
    Array.isArray(sample.reason_codes) && sample.reason_codes.every(reason => expectedReasons.has(reason)) &&
    Number.isInteger(sample.rotations) && sample.rotations >= 0 && sample.active_sessions === 1 &&
    sample.authentication_rejected === 0 && sample.consecutive_failures === 0 &&
    sample.responses_ok > 0 && sample.login_attempts >= 1 &&
    sample.login_succeeded === sample.login_attempts;
}

export function buildPush38GatewayDvrEndpointRecoveryManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_DVR_ENDPOINT_RECOVERY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_DVR_ENDPOINT_RECOVERY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_DVR_ENDPOINT_RECOVERY_TIME_INVALID");
  const item = PUSH38_GATEWAY_DVR_ENDPOINT_RECOVERY;
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
    throw new Error("P38_GATEWAY_DVR_ENDPOINT_RECOVERY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
