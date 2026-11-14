import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the failed 0.2.24 attempt. The runtime preserves the
// confirmed warm-handoff correction while the signed management code gives the
// real Home DVR a bounded five-minute startup/rollback observation window.
export const PUSH38_GATEWAY_STARTUP_WINDOW = Object.freeze({
  role: "GATEWAY_STARTUP_WINDOW",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-startup-window-a47982f4139f",
  version: "0.2.25-p38-health",
  buildSha: "4a3d3e39d082f11a636145f606f96557c397a157",
  digest: "a47982f4139f2d03d77acc0c6171c119a02f50c6aaaff8f24e8f138e1e838b98",
  size: 135813637,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-output-rescue-9934c36fe0a2",
  rollbackVersion: "0.2.23-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-confirmed-handoff-47fed292ea79",
  supersedesVersion: "0.2.24-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-heartbeat-login-0a956d9891db",
  priorManagementArtifactSha256: "0a956d9891db2f16195c8843a033af23d33467f2e43d3f9ce58344c1ad58a05d"
});

export function buildPush38GatewayStartupWindowManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_STARTUP_WINDOW_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_STARTUP_WINDOW_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_STARTUP_WINDOW_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_STARTUP_WINDOW;
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
    throw new Error("P38_GATEWAY_STARTUP_WINDOW_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
