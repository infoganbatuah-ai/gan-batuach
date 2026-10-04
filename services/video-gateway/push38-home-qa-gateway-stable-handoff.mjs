import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.14. The signed runtime preserves the existing
// supervisor/session fixes and prevents proactive warm replacement until a
// newly recovered DVR relay has completed its bounded stability window.
export const PUSH38_GATEWAY_STABLE_HANDOFF = Object.freeze({
  role: "GATEWAY_STABLE_HANDOFF",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-stable-handoff-afc7339384bb",
  version: "0.2.15-p38-health",
  buildSha: "a7bd4c75118e7b6df0f2ea49668fa13deb493cbc",
  digest: "afc7339384bb93a413ac3e66368382c22ce4e3377ee40dd0b8852583e5cc515e",
  size: 135796688,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58",
  rollbackVersion: "0.2.14-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58",
  priorManagementReleaseId: "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58",
  priorManagementArtifactSha256: "fb68c5180b585bd6460ae3a3720d437d23a9c042ed406ab92995cb724fc88032"
});

export function buildPush38GatewayStableHandoffManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_STABLE_HANDOFF_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_STABLE_HANDOFF_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_STABLE_HANDOFF_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_STABLE_HANDOFF;
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
    throw new Error("P38_GATEWAY_STABLE_HANDOFF_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
