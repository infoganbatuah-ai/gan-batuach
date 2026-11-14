import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The failed 0.2.67 live run and three controlled real-DVR Shadow runs proved
// two independent defects: the live recorder response was paced again by
// FFmpeg, and a late shared-session replacement could leave an output gap.
// This exact-device successor consumes the already-live response without
// read-rate throttling and renews the proven recorder session at the measured
// two-minute boundary through one serialized, exclusive epoch sweep. It also
// closes the undefined-owner cleanup crash observed by the OTA crash guard.
// Signed 0.2.64 remains the only activation/rollback predecessor; 0.2.67 stays
// immutable failed-qualification history and can never authorize this release.
export const PUSH38_GATEWAY_PROACTIVE_EXCLUSIVE_RENEWAL = Object.freeze({
  role: "GATEWAY_PROACTIVE_EXCLUSIVE_SESSION_RENEWAL",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-proactive-exclusive-322642bf9294",
  version: "0.2.68-p38-health",
  buildSha: "66e6f1c1535df9ec821333af53ec925d29b0bbd6",
  digest: "322642bf929494dd2a013a61e9d68fa30fd859ad55eb0aac9767c57c75830610",
  size: 135862758,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  rollbackVersion: "0.2.64-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  supersedesVersion: "0.2.64-p38-health",
  failedLiveReleaseId: "qa-p38-health-gateway-renewal-rescue-89071bf49a45",
  failedLiveVersion: "0.2.67-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayProactiveExclusiveRenewalManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_PROACTIVE_EXCLUSIVE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_PROACTIVE_EXCLUSIVE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_PROACTIVE_EXCLUSIVE_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_PROACTIVE_EXCLUSIVE_RENEWAL;
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
    throw new Error("P38_GATEWAY_PROACTIVE_EXCLUSIVE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
