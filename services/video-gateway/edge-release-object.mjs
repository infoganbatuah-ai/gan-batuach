const RELEASE_ID = /^[A-Za-z0-9._:-]{3,160}$/;
const DIGEST = /^[a-f0-9]{64}$/;
export const EDGE_RELEASE_BUCKET = "observer-edge-releases";
export const EDGE_RELEASE_R2_BUCKET = "digital-observer-releases";

// A signed manifest identifies immutable bytes, never a pre-authorized URL.
export function edgeReleaseObjectPath(manifest) {
  if (!RELEASE_ID.test(manifest?.release_id || "") || !DIGEST.test(manifest?.artifact_sha256 || ""))
    throw new Error("EDGE_RELEASE_OBJECT_ID_INVALID");
  return `${manifest.channel === "HOME_QA" ? "home-qa/" : ""}${manifest.release_id}/${manifest.artifact_sha256}.tar.gz`;
}

export function assertEdgeReleaseObjectUrl(manifest, storageOrigin) {
  const origin = new URL(storageOrigin);
  const artifact = new URL(manifest.artifact_url);
  const expectedPath = manifest.channel === "HOME_QA"
    ? `/${EDGE_RELEASE_R2_BUCKET}/${edgeReleaseObjectPath(manifest)}`
    : `/storage/v1/object/authenticated/${EDGE_RELEASE_BUCKET}/${edgeReleaseObjectPath(manifest)}`;
  if (origin.protocol !== "https:" || artifact.origin !== origin.origin || artifact.username || artifact.password ||
    artifact.search || artifact.hash || artifact.pathname !== expectedPath ||
    (manifest.channel === "HOME_QA" && !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname)))
    throw new Error("EDGE_RELEASE_OBJECT_URL_INVALID");
  return edgeReleaseObjectPath(manifest);
}

export function edgeReleaseScopeAllows(manifest, device) {
  if (manifest.profile !== device.profile || manifest.platform !== device.platform ||
    manifest.architecture !== device.architecture || manifest.channel !== device.channel) return false;
  if (["INTERNAL", "HOME_QA"].includes(manifest.channel) && manifest.rollout.stage === "INTERNAL_QA" &&
    (manifest.rollout.cohort_percent !== 0 || manifest.rollout.explicit_device_ids.length !== 1)) return false;
  if (manifest.channel === "HOME_QA" && manifest.rollout.stage !== "INTERNAL_QA") return false;
  return manifest.rollout.explicit_device_ids.includes(device.deviceId);
}
