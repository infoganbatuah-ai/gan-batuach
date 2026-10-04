import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.15. The recorder's authenticated session outlives
// its finite live.mp4 response, so this release renews the media response with
// a bounded warm handoff before the observed three-minute boundary.
export const PUSH38_GATEWAY_MEDIA_CADENCE = Object.freeze({
  role: "GATEWAY_MEDIA_CADENCE",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-media-cadence-2abe984fa273",
  version: "0.2.16-p38-health",
  buildSha: "f41715f9b56a50ca9b98870bf1a0fd4cefc7455d",
  digest: "2abe984fa2737a226a2a65869191617aaad39345288a935576c33239e1db80e9",
  size: 135796784,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58",
  rollbackVersion: "0.2.14-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-stable-handoff-afc7339384bb",
  priorManagementReleaseId: "qa-p38-health-gateway-stable-handoff-afc7339384bb",
  priorManagementArtifactSha256: "afc7339384bb93a413ac3e66368382c22ce4e3377ee40dd0b8852583e5cc515e"
});

export function buildPush38GatewayMediaCadenceManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_MEDIA_CADENCE_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_MEDIA_CADENCE_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_MEDIA_CADENCE_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_MEDIA_CADENCE;
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
    throw new Error("P38_GATEWAY_MEDIA_CADENCE_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
