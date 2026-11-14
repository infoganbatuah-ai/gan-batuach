import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The failed 0.2.76 remote-client qualification proved that the OTA agent and
// functional Gateway runtime were reading different identity stores. The OTA
// lifecycle retained the valid managed Ed25519 identity, while media grant
// claims still used the revoked legacy Product credential. This successor
// gives only managed-device/cloud authentication to the OTA identity store;
// DVR credentials and command-audit material remain in the Product Keychain.
// Signed 0.2.75 is the exact live rollback predecessor and quarantined 0.2.76
// remains ineligible.
export const PUSH38_GATEWAY_DEVICE_IDENTITY_CONTINUITY = Object.freeze({
  role: "GATEWAY_DEVICE_IDENTITY_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-device-identity-continuity-63cd90b08ec9",
  version: "0.2.77-p38-health",
  buildSha: "43780453c212634076db3cb278a59cd01ad6ba2d",
  digest: "63cd90b08ec98216c4113b2db9630d32b458fab8cbb9ac98f8582bc415037001",
  size: 135870910,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-sweep-confirmation-20d96603a933",
  rollbackVersion: "0.2.75-p38-health",
  quarantinedReleaseId: "qa-p38-health-gateway-finite-response-continuity-10c4c6d33593",
  quarantinedVersion: "0.2.76-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayDeviceIdentityContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_DEVICE_IDENTITY_CONTINUITY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_DEVICE_IDENTITY_CONTINUITY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_DEVICE_IDENTITY_CONTINUITY_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_DEVICE_IDENTITY_CONTINUITY;
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
    throw new Error("P38_GATEWAY_DEVICE_IDENTITY_CONTINUITY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
