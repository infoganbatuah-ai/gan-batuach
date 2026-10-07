import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

export const PUSH38_MANAGED_AUTH_CONTINUITY = Object.freeze({
  connector: Object.freeze({
    role: "CONNECTOR_STARTUP_DISCOVERY_RECOVERY",
    deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    releaseId: "qa-p38-health-connector-startup-recovery-2537bbb1007f",
    version: "0.2.40-p38-health",
    buildSha: "d80fb794f0dac331191ff7620b757449dc260b74",
    digest: "2537bbb1007fd8698b059985888c5a1a7d613944cec79b5e72d7ae22165e5566",
    size: 147508278,
    profile: "SOFTWARE_CONNECTOR",
    configVersion: 4,
    rollbackReleaseId: "qa-p38-health-connector-device-identity-continuity-c439a2c097bc",
    rollbackVersion: "0.2.36-p38-health",
    recoverablePriorFailure: null
  }),
  gateway: Object.freeze({
    role: "GATEWAY_AI_EVIDENCE_IO_ISOLATION",
    deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    releaseId: "qa-p38-health-gateway-ai-evidence-448b16ec54ff",
    version: "0.2.90-p38-health",
    buildSha: "7012a2c22ad080a3eb3cb3fe2b01241629073f87",
    digest: "448b16ec54ffeb77b41d33ce17eeeb030cbe6b32bd4edf0a520634aad622091c",
    size: 135896001,
    profile: "PHYSICAL_GATEWAY",
    configVersion: 1,
    rollbackReleaseId: "qa-p38-health-gateway-session-age-stability-26644a5e5900",
    rollbackVersion: "0.2.89-p38-health",
    recoverablePriorFailure: null
  })
});

export function push38ManagedAuthActivationStateAllows(component, state) {
  const item = PUSH38_MANAGED_AUTH_CONTINUITY[component];
  if (!item || !state || typeof state !== "object") return false;
  if (["HEALTHY", "ROLLED_BACK"].includes(state.state)) return true;
  const prior = item.recoverablePriorFailure;
  return Boolean(prior && state.state === "UPDATE_FAILED" && state.current_unchanged === true &&
    state.release_id === prior.releaseId && state.target_version === prior.version &&
    state.failure_category === prior.category);
}

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
