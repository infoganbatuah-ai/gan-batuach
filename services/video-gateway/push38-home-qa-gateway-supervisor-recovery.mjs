import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the finite-stream handoff release. The signed
// runtime preserves that DVR transport fix and adds the verified supervisor
// PID/crash-guard/liveness corrections that were developed after its late
// rollback. Signed 0.2.11 remains the rollback target.
export const PUSH38_GATEWAY_SUPERVISOR_RECOVERY = Object.freeze({
  role: "GATEWAY_SUPERVISOR_RECOVERY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58",
  version: "0.2.14-p38-health",
  buildSha: "4324fa116647b456404413c4c4b4dcb254a6a022",
  digest: "fb68c5180b585bd6460ae3a3720d437d23a9c042ed406ab92995cb724fc88032",
  size: 135794917,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-e354546bdbf8",
  rollbackVersion: "0.2.11-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-finite-handoff-76781a8e0832",
  priorManagementReleaseId: "qa-p38-health-gateway-finite-handoff-76781a8e0832",
  priorManagementArtifactSha256: "76781a8e08328feb154525451c5c4a26aaca43739279f9a052280758d1a02ffb"
});

export function buildPush38GatewaySupervisorRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_SUPERVISOR_RECOVERY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_SUPERVISOR_RECOVERY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_SUPERVISOR_RECOVERY_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_SUPERVISOR_RECOVERY;
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
    throw new Error("P38_GATEWAY_SUPERVISOR_RECOVERY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
