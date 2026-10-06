import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

export const PUSH38_MANAGED_AUTH_CONTINUITY = Object.freeze({
  connector: Object.freeze({
    role: "CONNECTOR_MANAGED_AUTH_CONTINUITY",
    deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    releaseId: "qa-p38-health-connector-managed-auth-60c0ade74168",
    version: "0.2.38-p38-health",
    buildSha: "dbd187f5f8f6f474d118858da48e72c3d13fb781",
    digest: "60c0ade7416888ac420b5df4ba21a53214cc1976c98c50b42928f2da79670c2f",
    size: 147507082,
    profile: "SOFTWARE_CONNECTOR",
    configVersion: 4,
    rollbackReleaseId: "qa-p38-health-connector-device-identity-continuity-c439a2c097bc",
    rollbackVersion: "0.2.36-p38-health"
  }),
  gateway: Object.freeze({
    role: "GATEWAY_MANAGED_AUTH_CONTINUITY",
    deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    releaseId: "qa-p38-health-gateway-managed-auth-555ee52844ef",
    version: "0.2.86-p38-health",
    buildSha: "dbd187f5f8f6f474d118858da48e72c3d13fb781",
    digest: "555ee52844ef427a0e0e776bb2b311b2a48bcbe885d3416f4a4db78a5ea0dedd",
    size: 135892177,
    profile: "PHYSICAL_GATEWAY",
    configVersion: 1,
    rollbackReleaseId: "qa-p38-health-gateway-correlated-silence-879c233e40db",
    rollbackVersion: "0.2.85-p38-health"
  })
});

export function buildPush38ManagedAuthContinuityManifest({ component, signingKeyId,
  artifactOrigin, releasedAt }) {
  const item = PUSH38_MANAGED_AUTH_CONTINUITY[component];
  if (!item) throw new Error("P38_MANAGED_AUTH_COMPONENT_INVALID");
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_MANAGED_AUTH_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_MANAGED_AUTH_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_MANAGED_AUTH_TIME_INVALID");
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: item.configVersion,
      maximum_config_version: item.configVersion, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_MANAGED_AUTH_OBJECT_MISMATCH");
  return { component, role: item.role, deviceId: item.deviceId, document };
}
