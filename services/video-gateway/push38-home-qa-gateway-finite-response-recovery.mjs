import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.81 pre-soak captured nine synchronized recorder response
// completions while the decoder processes remained alive draining buffered
// input. Recovery waited for child.close (about 41 seconds) and made the
// sources depend on consumer demand. This exact-device successor preserves
// the fresh HLS generation and enters the existing bounded recovery timer at
// the authoritative response-body completion. It changes no identity, source,
// channel, credential, session-rotation, or rollback contract.
export const PUSH38_GATEWAY_FINITE_RESPONSE_RECOVERY = Object.freeze({
  role: "GATEWAY_FINITE_RESPONSE_RECOVERY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-finite-response-recovery-aa3d561da937",
  version: "0.2.82-p38-health",
  buildSha: "d5848a134f655fc12878efc1b297da08053dfee1",
  digest: "aa3d561da937b689310f169622aefed61bdd7fc736ce7c48be4a5a2ff104e2ce",
  size: 135892104,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-dvr-endpoint-recovery-667d1ba76d68",
  rollbackVersion: "0.2.81-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-dvr-endpoint-recovery-667d1ba76d68",
  supersedesVersion: "0.2.81-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256:
    "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function gatewayFiniteResponseRecoveryBaselineAcceptable(sample = {}) {
  return sample.status === "healthy" && sample.assigned === 10 &&
    sample.connected === 10 && sample.failed === 0 && sample.empty === 6 &&
    sample.progressing === 10 && sample.stalled === 0 &&
    Array.isArray(sample.reason_codes) && sample.reason_codes.length === 0 &&
    Number.isInteger(sample.rotations) && sample.rotations >= 0 &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts;
}

export function buildPush38GatewayFiniteResponseRecoveryManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_RECOVERY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_RECOVERY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) ||
    Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_RECOVERY_TIME_INVALID");
  const item = PUSH38_GATEWAY_FINITE_RESPONSE_RECOVERY;
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
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_RECOVERY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
