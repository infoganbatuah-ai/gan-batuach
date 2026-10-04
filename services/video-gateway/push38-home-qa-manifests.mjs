import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// These are the already-qualified bytes. Publication must never rebuild them.
const releases = Object.freeze([
  { role: "CONNECTOR_TRANSITION", deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    releaseId: "qa-connector-legacy-transition-v2-6e7988808b05", version: "0.1.0-legacy",
    buildSha: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a",
    digest: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a", size: 146778302,
    profile: "SOFTWARE_CONNECTOR" },
  { role: "CONNECTOR_REMEDIATION", deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    releaseId: "qa-p38-health-connector-1b076f596574", version: "0.2.9-p38-health",
    buildSha: "04874417c764582968f6c94312594e9770178fea",
    digest: "1b076f5965744a903c3c601d8c424c7b127bdcb0d06f49c72eff8b9345bdfc27", size: 147375602,
    profile: "SOFTWARE_CONNECTOR" },
  { role: "GATEWAY_REMEDIATION", deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    releaseId: "qa-p38-health-gateway-6c9d08327ec6", version: "0.2.9-p38-health",
    buildSha: "04874417c764582968f6c94312594e9770178fea",
    digest: "6c9d08327ec6f38db3fc55c4c344f4db6fc0d0adab5c68e3ec3f1c1164f11c95", size: 135764626,
    profile: "PHYSICAL_GATEWAY" }
]);

export function buildPush38HomeQaManifests({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || "")) throw new Error("P38_HOME_QA_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash) throw new Error("P38_HOME_QA_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_HOME_QA_RELEASE_TIME_INVALID");
  return releases.map(item => {
    const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
      version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
      architecture: "arm64", profile: item.profile,
      artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
      artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
      compatibility: { minimum_current_version: "0.1.0-legacy", maximum_current_version: null,
        minimum_config_version: 1, maximum_config_version: 9999, security_floor_version: "0.1.0-legacy" },
      released_at: releasedAt, rollout: { stage: "INTERNAL_QA", cohort_seed: "push38-home-qa-exact-device",
        cohort_percent: 0, explicit_device_ids: [item.deviceId] },
      signature: Buffer.alloc(64).toString("base64url") };
    validateEdgeUpdateManifest(document);
    if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
      throw new Error("P38_HOME_QA_OBJECT_MISMATCH");
    return { role: item.role, deviceId: item.deviceId, document };
  });
}
