import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.16. Recorder heartbeats, proactive login renewal
// and finite-media handoffs run on independent bounded schedulers so a slow
// channel handoff cannot starve the shared authenticated DVR session.
export const PUSH38_GATEWAY_MAINTENANCE_ISOLATION = Object.freeze({
  role: "GATEWAY_MAINTENANCE_ISOLATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-maintenance-isolation-995d6f822468",
  version: "0.2.17-p38-health",
  buildSha: "04c58f24f4e207e3dab9302796f7b0edace8eca5",
  digest: "995d6f822468f5a2f8b5be59d338c46ddc0d4647b28068d999a972fb13953efe",
  size: 135797570,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-media-cadence-2abe984fa273",
  rollbackVersion: "0.2.16-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-media-cadence-2abe984fa273",
  priorManagementReleaseId: "qa-p38-health-gateway-media-cadence-2abe984fa273",
  priorManagementArtifactSha256: "2abe984fa2737a226a2a65869191617aaad39345288a935576c33239e1db80e9"
});

export function buildPush38GatewayMaintenanceIsolationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_MAINTENANCE_ISOLATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_MAINTENANCE_ISOLATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_MAINTENANCE_ISOLATION_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_MAINTENANCE_ISOLATION;
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
    throw new Error("P38_GATEWAY_MAINTENANCE_ISOLATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
