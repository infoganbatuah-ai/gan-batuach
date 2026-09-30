import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor built after the quarantined 0.2.32 attempt. The
// installed signed 0.2.26 release remains the rollback and compatibility
// floor. This release preserves ffprobe's verified H.264 codec so the relay
// selects the existing zero-copy path instead of consuming a CPU core on an
// unnecessary software transcode.
export const PUSH38_CONNECTOR_CODEC_PRESERVATION = Object.freeze({
  role: "CONNECTOR_CODEC_PRESERVATION_FROM_KNOWN_GOOD",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-codec-preservation-70ea29e3dcad",
  version: "0.2.34-p38-health",
  buildSha: "0ffe282cddc8ae656f473cb5dd59229b51a61092",
  digest: "70ea29e3dcada6db54eb2138046fff26a62d115af43bef8bfdc533dc84727187",
  size: 147436944,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-rtsp-cadence-559bb01f78a2",
  rollbackVersion: "0.2.26-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-liveness-isolation-e46f2cb0daf6",
  predecessorDigest: "e46f2cb0daf617cc80a5b8c2be1f448820ab391667992d390ab63de36afd1e53",
  agentPredecessorReleaseId: "qa-p38-health-connector-rtsp-cadence-559bb01f78a2",
  agentPredecessorDigest: "559bb01f78a2275f6dfc05723673250318803fbf68a8fd111f93084cbb47e02f"
});

export function buildPush38ConnectorCodecPreservationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_CODEC_PRESERVATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_CODEC_PRESERVATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_CODEC_PRESERVATION_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_CODEC_PRESERVATION;
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: 4,
      maximum_config_version: 4, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_CONNECTOR_CODEC_PRESERVATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
