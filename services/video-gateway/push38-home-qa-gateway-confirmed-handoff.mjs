import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to 0.2.23. Live canary evidence proved that promoting a
// warm DVR relay after only its first playlist write can expose a one-sample
// channel outage. This release requires a subsequent HLS advance before the
// replacement becomes authoritative and records input/output cadence.
export const PUSH38_GATEWAY_CONFIRMED_HANDOFF = Object.freeze({
  role: "GATEWAY_CONFIRMED_HANDOFF",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-confirmed-handoff-47fed292ea79",
  version: "0.2.24-p38-health",
  buildSha: "ab855c89dbb2f013af8c1884e7786d6d67a92b36",
  digest: "47fed292ea79808c47b10433c0b78d9c8082356bc64187cf40cbf8ce5f163e34",
  size: 135811887,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-output-rescue-9934c36fe0a2",
  rollbackVersion: "0.2.23-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-output-rescue-9934c36fe0a2",
  supersedesVersion: "0.2.23-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-heartbeat-login-0a956d9891db",
  priorManagementArtifactSha256: "0a956d9891db2f16195c8843a033af23d33467f2e43d3f9ce58344c1ad58a05d"
});

export function buildPush38GatewayConfirmedHandoffManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_CONFIRMED_HANDOFF_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_CONFIRMED_HANDOFF_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_CONFIRMED_HANDOFF_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_CONFIRMED_HANDOFF;
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
    throw new Error("P38_GATEWAY_CONFIRMED_HANDOFF_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
