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
    releaseId: "qa-p38i-connector-069c91593f8b", version: "0.2.8-p38i",
    buildSha: "069c91593f8b1f74519f8ac2f85b80d4002f9166",
    digest: "244ccc5661bcde5e85fcfe6b6712fc7096ee099e63153783ed2bafac6a8aa882", size: 147360407,
    profile: "SOFTWARE_CONNECTOR" },
  { role: "GATEWAY_REMEDIATION", deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    releaseId: "qa-p38i-gateway-069c91593f8b", version: "0.2.8-p38i",
    buildSha: "069c91593f8b1f74519f8ac2f85b80d4002f9166",
    digest: "c202aafe65ac7f3cf14e8bc51b9bdfcb84702fa1b1de2629fc03685af316e028", size: 135759651,
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
