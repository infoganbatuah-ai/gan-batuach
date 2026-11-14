import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Corrective Gateway release built from the exact CI-qualified candidate after
// the first 0.2.9 attempt proved that its embedded management agent still
// required the retired Product legacy credential. The artifact contains the
// managed Ed25519 health contract; it does not contain credentials or keys.
export const PUSH38_GATEWAY_AUTH_RECOVERY = Object.freeze({
  role: "GATEWAY_AUTH_RECOVERY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-auth-4197f1a246f1",
  version: "0.2.10-p38-health",
  buildSha: "d9c0b804102b62fe9c7ffa522c30386e4536a4a3",
  digest: "4197f1a246f1cf4dcb909d8b6e03651a05753c1b6fffdc727484e5410686bdef",
  size: 135783981,
  profile: "PHYSICAL_GATEWAY"
});

export function buildPush38GatewayAuthRecoveryManifest({ signingKeyId, artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || "")) throw new Error("P38_GATEWAY_AUTH_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash) throw new Error("P38_GATEWAY_AUTH_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_AUTH_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_AUTH_RECOVERY;
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
    throw new Error("P38_GATEWAY_AUTH_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
