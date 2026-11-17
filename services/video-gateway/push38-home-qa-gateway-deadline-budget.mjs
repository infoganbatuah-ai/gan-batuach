import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to 0.2.40. The live nine-source proof showed that a
// failed warm candidate could occupy a twelve-second scheduler slot for up to
// twenty-three seconds, invalidating the deadline calculation. This release
// makes probation occupancy equal to the declared slot budget and serves the
// least-fresh playlist first without changing stale or trust thresholds.
export const PUSH38_GATEWAY_DEADLINE_BUDGET = Object.freeze({
  role: "GATEWAY_DEADLINE_BUDGET",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-deadline-budget-42702082e62f",
  version: "0.2.41-p38-health",
  buildSha: "72b25159f8214bc60602835d77ef199620eebb77",
  digest: "42702082e62fffac7741d17ffdae62051822f951be03c0b8d0f5a2000297f854",
  size: 135835245,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-sweep-deadline-f2490d2f0046",
  rollbackVersion: "0.2.40-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-sweep-deadline-f2490d2f0046",
  supersedesVersion: "0.2.40-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

export function buildPush38GatewayDeadlineBudgetManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_DEADLINE_BUDGET_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_DEADLINE_BUDGET_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_DEADLINE_BUDGET_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_DEADLINE_BUDGET;
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
    throw new Error("P38_GATEWAY_DEADLINE_BUDGET_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
