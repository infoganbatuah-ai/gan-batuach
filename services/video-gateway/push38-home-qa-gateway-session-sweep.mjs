import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Immutable successor to the quarantined 0.2.18 attempt. A renewed recorder
// session drains every stale relay epoch immediately, without overlapping
// channel replacements, so one slow handoff cannot consume the prior-login
// response-retirement window.
export const PUSH38_GATEWAY_SESSION_SWEEP = Object.freeze({
  role: "GATEWAY_SESSION_DRAIN",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-session-drain-5165c94df699",
  version: "0.2.19-p38-health",
  buildSha: "6bf33d4bd85f6c251c55bdd8b5b637aeb22ae32f",
  digest: "5165c94df6992ff89074fe74ee0e08fefecff6e28b7c364bd488f9b2bf696801",
  size: 135809270,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-maintenance-isolation-995d6f822468",
  rollbackVersion: "0.2.17-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-session-sweep-0a64245f8a97",
  supersedesVersion: "0.2.18-p38-health",
  priorManagementReleaseId: "qa-p38-health-gateway-session-sweep-0a64245f8a97",
  priorManagementArtifactSha256: "0a64245f8a97ae9724ea5349ff36a32113ff4a8c826c7ce22b2ef2b191c83e4c"
});

export function buildPush38GatewaySessionSweepManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_SESSION_SWEEP_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_SESSION_SWEEP_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_SESSION_SWEEP_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_SESSION_SWEEP;
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
    throw new Error("P38_GATEWAY_SESSION_SWEEP_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
