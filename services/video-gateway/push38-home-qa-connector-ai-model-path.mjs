import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// The signed 0.2.36 Connector is healthy for transport and remains the exact
// rollback target. Its packaged object model was not selected when the legacy
// mutable data directory was configured, so the inference worker failed closed.
// This successor changes only portable packaged-model resolution.
export const PUSH38_CONNECTOR_AI_MODEL_PATH = Object.freeze({
  role: "CONNECTOR_AI_MODEL_PATH_FROM_KNOWN_GOOD",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-ai-model-path-34408b2cc48e",
  version: "0.2.37-p38-health",
  buildSha: "6ade377f467d91e50800a2161926cda3d31d8eab",
  digest: "34408b2cc48e57700ae9f86a4575624d96e499c0d2a43dc68217bba1c1e09eb8",
  size: 147488102,
  profile: "SOFTWARE_CONNECTOR",
  rollbackReleaseId: "qa-p38-health-connector-device-identity-continuity-c439a2c097bc",
  rollbackVersion: "0.2.36-p38-health",
  supersedesReleaseId: "qa-p38-health-connector-device-identity-continuity-c439a2c097bc",
  agentPredecessorReleaseId: "qa-p38-health-connector-observed-health-3a211a8ef1c2",
  agentPredecessorDigest: "3a211a8ef1c275283194ea7a4ef93ba59e6f560b7b8cc01dca43a28d03e6f395"
});

export function buildPush38ConnectorAiModelPathManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_CONNECTOR_AI_MODEL_PATH_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_CONNECTOR_AI_MODEL_PATH_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_CONNECTOR_AI_MODEL_PATH_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_AI_MODEL_PATH;
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: 4,
      maximum_config_version: 4, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_CONNECTOR_AI_MODEL_PATH_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
