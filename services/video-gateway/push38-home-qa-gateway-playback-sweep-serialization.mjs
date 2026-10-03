import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.73 V8 run isolated a hardware-render stall: the DVR input,
// shared session and Gateway process remained live while one VideoToolbox HLS
// output disappeared for one checkpoint. This successor retains the proven
// single-owner/session-sweep path and adds the exact hardware-output rescue and
// per-service HLS namespace shipped by the pinned candidate. Signed 0.2.73 is
// the exact live activation and rollback predecessor; older playback-sweep
// releases remain historical and ineligible.
export const PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION = Object.freeze({
  role: "GATEWAY_HARDWARE_OUTPUT_STALL_RESCUE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-hardware-output-rescue-f43358023c15",
  version: "0.2.74-p38-health",
  buildSha: "d6403447eded40e341f01b2067ccacf8d564a657",
  digest: "f43358023c15d975003fa86a41cdd53ced8f2f70294f65ff4b9ddb98f01e06b4",
  size: 135864508,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-unique-health-45d09d249eb2",
  rollbackVersion: "0.2.73-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-unique-health-45d09d249eb2",
  supersedesVersion: "0.2.73-p38-health",
  failedV8ReleaseId: "qa-p38-health-gateway-unique-health-45d09d249eb2",
  failedV8Version: "0.2.73-p38-health",
  failedV8BuildSha: "f9fd0266fb2a3112d0f2096e868973893a657411",
  failedV8ResultSha256: "3ace610558222f06c694defbeb316a64f262a9c5f5ceb31db185b968a7bc9fc9",
  failedV8CheckpointsSha256: "80c5bba8ab1f22790656735ca6b2168352f3e617d12c8e99e18960f965b6afbc",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayPlaybackSweepSerializationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION;
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
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
