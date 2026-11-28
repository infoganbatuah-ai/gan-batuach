import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

export const PUSH38_CONNECTOR_STARTUP_RECOVERY = Object.freeze({
  role: "CONNECTOR_STARTUP_RECOVERY",
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  releaseId: "qa-p38-health-connector-startup-d44b7e4262f9",
  version: "0.2.12-p38-health",
  buildSha: "884cf702b995af4bfe69d7476d272cc3095bd246",
  digest: "d44b7e4262f9a7c9051a8c3e15258c612791546b1bfeaddf6f95c04ee706d388",
  size: 147376976,
  profile: "SOFTWARE_CONNECTOR"
});

export function buildPush38ConnectorStartupRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || "")) throw new Error("P38_STARTUP_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash) throw new Error("P38_STARTUP_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_STARTUP_RELEASE_TIME_INVALID");
  const item = PUSH38_CONNECTOR_STARTUP_RECOVERY;
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
    throw new Error("P38_STARTUP_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
