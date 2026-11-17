import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.19. The recorder heartbeat keeps the current
// authenticated login authoritative while media relays are progressing. A
// background replacement login is allowed only after sustained heartbeat
// failure and only when no recorder relay is currently progressing.
export const PUSH38_GATEWAY_HEARTBEAT_LOGIN = Object.freeze({
  role: "GATEWAY_HEARTBEAT_LOGIN_PRESERVATION",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-heartbeat-login-0a956d9891db",
  version: "0.2.20-p38-health",
  buildSha: "6d515326502dbd9d3d7ca0e0249bd7a696324fca",
  digest: "0a956d9891db2f16195c8843a033af23d33467f2e43d3f9ce58344c1ad58a05d",
  size: 135809999,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-drain-5165c94df699",
  rollbackVersion: "0.2.19-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-session-drain-5165c94df699",
  supersedesVersion: "0.2.19-p38-health",
  priorManagementReleaseId: "qa-p38-health-gateway-session-drain-5165c94df699",
  priorManagementArtifactSha256: "5165c94df6992ff89074fe74ee0e08fefecff6e28b7c364bd488f9b2bf696801"
});

export function buildPush38GatewayHeartbeatLoginManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_HEARTBEAT_LOGIN_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_HEARTBEAT_LOGIN_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_HEARTBEAT_LOGIN_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_HEARTBEAT_LOGIN;
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
    throw new Error("P38_GATEWAY_HEARTBEAT_LOGIN_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
