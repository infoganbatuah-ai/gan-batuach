import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

export const PUSH38_MANAGED_AUTH_CONTINUITY = Object.freeze({
  connector: Object.freeze({
    role: "CONNECTOR_RTSP_RECOVERY_CONTINUITY",
    deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    releaseId: "qa-p38-health-connector-rtsp-recovery-continuity-d612f4855281",
    version: "0.2.41-p38-health",
    buildSha: "c14ac38bf7b1e2313b8509a5204aee23c8c4e9aa",
    digest: "d612f4855281fd7aeadf02b283db3c7f64c5c2585503530140abd6876a8b8790",
    size: 147512735,
    profile: "SOFTWARE_CONNECTOR",
    configVersion: 4,
    rollbackReleaseId: "qa-p38-health-connector-startup-recovery-2537bbb1007f",
    rollbackVersion: "0.2.40-p38-health",
    recoverablePriorFailure: null
  }),
  gateway: Object.freeze({
    role: "GATEWAY_EXCLUSIVE_HANDOFF_RETENTION",
    deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    releaseId: "qa-p38-health-gateway-exclusive-handoff-retention-1fb10cf04dd4",
    version: "0.2.98-p38-health",
    buildSha: "e2d51e585b2aab379f294398ecc5f24416aad9c4",
    digest: "1fb10cf04dd4d4e4273c7fd92d40a1351e22ff59ab40449503f84a40d2d1e3ac",
    size: 135902554,
    profile: "PHYSICAL_GATEWAY",
    configVersion: 1,
    rollbackReleaseId: "qa-p38-health-gateway-bounded-correlated-recovery-b53cb51b8663",
    rollbackVersion: "0.2.97-p38-health",
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
