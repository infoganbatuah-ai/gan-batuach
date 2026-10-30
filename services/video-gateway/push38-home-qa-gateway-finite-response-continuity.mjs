import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.75 V8 run proved one bounded continuity gap when several
// natural finite DVR responses ended together. Canonical replacements were
// already running, but ordinary finite-response recovery did not retain the
// still-fresh HLS generation as an explicit continuity owner. This successor
// preserves that generation only while canonical recovery is in flight and
// only until the existing hard-stale deadline. Signed 0.2.75 is the exact
// rollback predecessor; all earlier releases remain historical/ineligible.
export const PUSH38_GATEWAY_FINITE_RESPONSE_CONTINUITY = Object.freeze({
  role: "GATEWAY_FINITE_RESPONSE_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-finite-response-continuity-10c4c6d33593",
  version: "0.2.76-p38-health",
  buildSha: "591d5b97fa24a31ab540a7ceaef8ec9e5ad9335f",
  digest: "10c4c6d33593f4c2796789eecb24faa0abd9c26448c8a6190600f61742dd140c",
  size: 135864938,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-sweep-confirmation-20d96603a933",
  rollbackVersion: "0.2.75-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-session-sweep-confirmation-20d96603a933",
  supersedesVersion: "0.2.75-p38-health",
  failedV8ReleaseId: "qa-p38-health-gateway-session-sweep-confirmation-20d96603a933",
  failedV8Version: "0.2.75-p38-health",
  failedV8BuildSha: "0a41a628a79b6a9ef3f43b031bf802371f9913ed",
  failedV8ResultSha256: "dd46c2f58102ea1fd00828323c38634ac1614b9dfced56895be73759697755ec",
  failedV8CheckpointsSha256: "6e65bae6257f5a15c7ce7108752b755be81c2b2d113afad7ec1a2e91afabfbae",
  failedV8SummarySha256: "d3e4f2d5aa143dd67bc0394b74fd75114e27f80e7bd3f56d1a69f440f0b34a56",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayFiniteResponseContinuityManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_CONTINUITY_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_CONTINUITY_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_CONTINUITY_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_FINITE_RESPONSE_CONTINUITY;
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
    throw new Error("P38_GATEWAY_FINITE_RESPONSE_CONTINUITY_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
