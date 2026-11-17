import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.74 pre-soak exposed one exact ownership gap: session-sweep
// replacements were promoted after the first playlist write with zero later
// output advances. Seven such owners ended together; two output-rescue owners
// that had proved five advances remained healthy. This successor applies the
// already-qualified four-advance/six-second promotion proof to both ordinary
// and exclusive session sweeps. Signed 0.2.74 is the exact live rollback
// predecessor; all older playback-sweep releases remain historical/ineligible.
export const PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION = Object.freeze({
  role: "GATEWAY_SESSION_SWEEP_SUSTAINED_PROMOTION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-session-sweep-confirmation-20d96603a933",
  version: "0.2.75-p38-health",
  buildSha: "0a41a628a79b6a9ef3f43b031bf802371f9913ed",
  digest: "20d96603a9334ef85adb8e134fc81fce753b8bf5d76d15534666ce64b8372f80",
  size: 135864532,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-hardware-output-rescue-f43358023c15",
  rollbackVersion: "0.2.74-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-hardware-output-rescue-f43358023c15",
  supersedesVersion: "0.2.74-p38-health",
  failedPreSoakReleaseId: "qa-p38-health-gateway-hardware-output-rescue-f43358023c15",
  failedPreSoakVersion: "0.2.74-p38-health",
  failedPreSoakBuildSha: "d6403447eded40e341f01b2067ccacf8d564a657",
  failedPreSoakResultSha256: "9f0bc70bc1bc6a9ed2c17fdf2332a660c56483a811f2aaf696749485ad667cba",
  failedPreSoakCheckpointsSha256: "8bd8693aec97e25dd961876a1012b4825dd99ec278c7e10da6eee93ee9baa614",
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
