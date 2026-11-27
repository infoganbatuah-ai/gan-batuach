import { createHash } from "node:crypto";
import { compareSemanticVersions, evaluateEdgeUpdateEligibility, validateEdgeUpdateManifest,
  verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "../../services/video-gateway/edge-release-object.mjs";
import { signRemoteEdgeDocument, validateRemoteSignerConfig } from "./remote-ed25519-signer.mjs";

export const CLIENT_SOURCE = "37f76e5ea79320fcd7a850546e58e8bef0ba3b28";
export const BACKEND_SOURCE = "b9a2001cfd1fab3d24966083a785734f147657e8";
const repository = "infoganbatuah-ai/gan-batuach";
const ref = "refs/heads/codex/push-38-aws-signing";
const workflow = `${repository}/.github/workflows/home-media-recovery-signing.yml@${ref}`;
const keyId = "observer-kms-release-v1";
const placeholder = Buffer.alloc(64).toString("base64url");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const targets = Object.freeze({
  PHYSICAL_GATEWAY: Object.freeze({ baseline: "0.2.101-p38-health", version: "0.2.103-product-identity", configVersion: 1,
    baselineReleaseDigest: "d6e5ff7a8aac6a612c46516ebb1d370a3436f4c8a1c63f62ce7ae316f737e988",
    artifactDigest: "bf05eba88f1dcdd0499e67524ff9832c9588ea93f792e9beebbadc4a9a56b8c1", size: 135883624 }),
  SOFTWARE_CONNECTOR: Object.freeze({ baseline: "0.2.40-p38-health", version: "0.2.42-product-identity", configVersion: 4,
    baselineReleaseDigest: "fd87c2590f85146fbdfc8738f397227f2c5fe58f6efc1f79e47b533dac2793f0",
    artifactDigest: "318f46432ad2fd0a3e6f6ddc905762252e99eb73a1b542761ff14b65c31beb79", size: 147479760 })
});

export function preparePinnedHomeMediaRecovery({ profile, baselineRelease, trustedPublicKeys, releasedAt }) {
  if (!Object.hasOwn(targets, profile)) throw new Error("HOME_MEDIA_PROFILE_INVALID");
  const target = targets[profile];
  if (digest(baselineRelease) !== target.baselineReleaseDigest) throw new Error("HOME_MEDIA_BASELINE_DIGEST_MISMATCH");
  const checked = verifyEdgeUpdateManifest(JSON.parse(baselineRelease), trustedPublicKeys);
  if (!checked.ok) throw new Error("HOME_MEDIA_BASELINE_UNTRUSTED");
  const baseline = checked.manifest;
  if (baseline.channel !== "HOME_QA" || baseline.profile !== profile || baseline.version !== target.baseline ||
    baseline.platform !== "darwin" || baseline.architecture !== "arm64" || baseline.signing_key_id !== keyId ||
    baseline.rollout.stage !== "INTERNAL_QA" || baseline.rollout.cohort_percent !== 0 ||
    baseline.rollout.explicit_device_ids.length !== 1 || compareSemanticVersions(target.version, target.baseline) <= 0) {
    throw new Error("HOME_MEDIA_BASELINE_SCOPE_INVALID");
  }
  const releaseId = `home-media-recovery-${profile.toLowerCase().replaceAll("_", "-")}-${target.version}`;
  const storageOrigin = new URL(baseline.artifact_url).origin;
  assertEdgeReleaseObjectUrl(baseline, storageOrigin);
  const artifactPath = edgeReleaseObjectPath({ channel: "HOME_QA", release_id: releaseId, artifact_sha256: target.artifactDigest });
  const artifactUrl = new URL(`/${EDGE_RELEASE_R2_BUCKET}/${artifactPath}`, storageOrigin);
  const document = validateEdgeUpdateManifest({
    protocol: baseline.protocol, release_id: releaseId, version: target.version, build_sha: CLIENT_SOURCE,
    channel: "HOME_QA", platform: baseline.platform, architecture: baseline.architecture, profile,
    artifact_url: artifactUrl.href, artifact_sha256: target.artifactDigest, artifact_size: target.size,
    signing_key_id: keyId, compatibility: { minimum_current_version: target.baseline, maximum_current_version: target.baseline,
      minimum_config_version: target.configVersion, maximum_config_version: target.configVersion,
      security_floor_version: baseline.compatibility.security_floor_version },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA", cohort_seed: releaseId, cohort_percent: 0,
      explicit_device_ids: baseline.rollout.explicit_device_ids }, signature: placeholder
  });
  assertEdgeReleaseObjectUrl(document, storageOrigin);
  const eligibility = evaluateEdgeUpdateEligibility(document, { profile, platform: baseline.platform,
    architecture: baseline.architecture, channel: "HOME_QA", currentVersion: target.baseline,
    configVersion: target.configVersion, deviceId: baseline.rollout.explicit_device_ids[0] });
  if (!eligibility.eligible) throw new Error("HOME_MEDIA_TARGET_INCOMPATIBLE");
  return document;
}

export function prepareHomeMediaRecovery(input) {
  const document = preparePinnedHomeMediaRecovery(input);
  if (!verifyEdgeArtifact(input.artifact, document).ok) throw new Error("HOME_MEDIA_ARTIFACT_MISMATCH");
  return document;
}

// Only a reviewed protected job supplies job context, immutable source pins and transport.
// The backend pin identifies the compatibility contract, not live deployment evidence.
export async function issueHomeMediaRecovery({ env, approvedWorkflowSha, config, call, detached = false, ...input }) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== ref ||
    env.GITHUB_WORKFLOW_REF !== workflow || env.HOME_MEDIA_SIGNING_ENVIRONMENT !== "HOME_QA_SIGNING" ||
    !/^[a-f0-9]{40}$/.test(approvedWorkflowSha) || env.GITHUB_SHA !== approvedWorkflowSha ||
    env.HOME_MEDIA_CLIENT_SHA !== CLIENT_SOURCE || env.HOME_MEDIA_BACKEND_SHA !== BACKEND_SOURCE ||
    env.HOME_MEDIA_PROFILE !== input.profile || (detached && env.HOME_MEDIA_SIGNING_INPUT_MODE !== "DETACHED")) throw new Error("HOME_MEDIA_SIGNING_CONTEXT_INVALID");
  validateRemoteSignerConfig(config);
  const trustedKey = input.trustedPublicKeys?.[keyId];
  if (config.role !== "RELEASE_MANIFEST" || config.keyId !== keyId || typeof trustedKey !== "string" ||
    config.publicKeySha256 !== digest(Buffer.from(trustedKey, "base64url"))) {
    throw new Error("HOME_MEDIA_SIGNER_NOT_PINNED");
  }
  const document = detached ? preparePinnedHomeMediaRecovery(input) : prepareHomeMediaRecovery(input);
  const result = await signRemoteEdgeDocument({ document, config, call });
  if (!verifyEdgeUpdateManifest(result.document, input.trustedPublicKeys).ok) throw new Error("HOME_MEDIA_SIGNATURE_UNTRUSTED");
  return result;
}
