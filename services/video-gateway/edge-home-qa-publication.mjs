import { verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "./edge-release-object.mjs";

// Preflight only. This never publishes a release or relaxes the normal OTA verifier.
export function verifyHomeQaReleaseForDevice({ manifest, trustedPublicKeys, deviceId, profile, artifactOrigin }) {
  const verified = verifyEdgeUpdateManifest(manifest, trustedPublicKeys);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  const release = verified.manifest;
  if (release.profile !== profile) return { ok: false, reason: "HOME_QA_WRONG_PROFILE" };
  if (release.channel !== "HOME_QA" || release.rollout.stage !== "INTERNAL_QA")
    return { ok: false, reason: "HOME_QA_WRONG_CHANNEL" };
  if (release.rollout.cohort_percent !== 0 || release.rollout.explicit_device_ids.length !== 1 ||
    release.rollout.explicit_device_ids[0] !== deviceId)
    return { ok: false, reason: "HOME_QA_TARGET_NOT_EXACT" };
  try { assertEdgeReleaseObjectUrl(release, artifactOrigin); }
  catch { return { ok: false, reason: "HOME_QA_ARTIFACT_ENDPOINT_UNAPPROVED" }; }
  return { ok: true, release_id: release.release_id, artifact_sha256: release.artifact_sha256 };
}
