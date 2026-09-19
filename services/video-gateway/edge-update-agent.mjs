import { readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { EdgeUpdateManager, downloadEdgeUpdateArtifact } from "./edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "./edge-release-trust.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
export async function reportEdgeUpdateStatus(cloudRequest, releaseId, result) {
  if (!releaseId || !["HEALTHY", "ROLLED_BACK", "ACTION_REQUIRED"].includes(result.state)) return;
  await cloudRequest({ method: "POST", path: "/api/video-gateway/edge-updates", operation: "UPDATE_STATUS",
    body: { release_id: releaseId, state: result.state, current_version: result.current_version,
      known_good_version: result.known_good_version, failure_category: result.failure_category || null } });
}

/** Shared outbound-first update cycle for Software Connector, Physical Gateway and future Enterprise Edge. */
export async function runEdgeUpdateCycle({
  root, trustedPublicKeys, trustRegistryPath = PROTECTED_EDGE_TRUST_REGISTRY_PATH,
  device, cloudRequest, adapter, healthCheck, download = downloadEdgeUpdateArtifact,
  onTransition = () => {}, qaRootPinPath = "", qaIsolationRoot = ""
}) {
  if (typeof cloudRequest !== "function") fail("EDGE_UPDATE_CLOUD_CLIENT_REQUIRED");
  if (trustedPublicKeys) fail("EDGE_UPDATE_UNPINNED_KEYS_FORBIDDEN");
  const qa = Boolean(qaRootPinPath || qaIsolationRoot);
  if (qa) {
    const scope = resolve(qaIsolationRoot), actual = realpathSync(scope);
    if (!qaRootPinPath || !scope.startsWith(`${tmpdir()}/`) || !actual.startsWith(`${realpathSync(tmpdir())}/`) ||
      ![root, trustRegistryPath, qaRootPinPath].every(path => resolve(path).startsWith(`${scope}/`)) ||
      adapter.plan?.().qa !== true) fail("EDGE_UPDATE_QA_SCOPE_INVALID");
  }
  const verifiedKeys = loadPinnedEdgeReleaseKeys({ registryPath: trustRegistryPath,
    ...(qa ? { rootPinPath: qaRootPinPath, qaOwnerAllowed: true } : {}) }).trustedPublicKeys;
  if (!verifiedKeys || !Object.keys(verifiedKeys).length) fail("EDGE_UPDATE_TRUST_KEYS_REQUIRED");
  const manager = new EdgeUpdateManager({ root, trustedPublicKeys: verifiedKeys, device, adapter, healthCheck });
  if (!manager.current().slot || !manager.knownGood().length) fail("EDGE_UPDATE_SIGNED_BOOTSTRAP_REQUIRED");
  const plan = await cloudRequest({ method: "GET", path: "/api/video-gateway/edge-updates", operation: "UPDATE_READ",
    query: { platform: device.platform, architecture: device.architecture, profile: device.profile,
      current_version: manager.current().version, config_version: device.configVersion, channel: device.channel } });
  if (!plan?.manifest) return manager.status();
  const verified = verifyEdgeUpdateManifest(plan.manifest, verifiedKeys);
  if (!verified.ok) fail(verified.reason);
  const manifest = verified.manifest;
  if (manifest.release_id === manager.current().release_id ||
    manager.quarantine().some(item => item.release_id === manifest.release_id)) return manager.status();
  const destination = `${root}/downloads/${manifest.release_id}.artifact`;
  await onTransition({ state: "DOWNLOADING", release_id: manifest.release_id });
  let url = manifest.artifact_url;
  if (!qa) {
    const grant = await cloudRequest({ method: "POST", path: "/api/video-gateway/edge-updates/download",
      operation: "UPDATE_READ", body: { release_id: manifest.release_id, platform: device.platform,
        architecture: device.architecture, profile: device.profile, channel: device.channel,
        current_version: manager.current().version, config_version: device.configVersion } });
    const expiry = Date.parse(grant?.expires_at || "");
    const grantedUrl = new URL(grant?.url || "https://invalid.example/");
    const artifactUrl = new URL(manifest.artifact_url);
    if (grant?.release_id !== manifest.release_id || grant?.artifact_sha256 !== manifest.artifact_sha256 ||
      grant?.artifact_size !== manifest.artifact_size || !Number.isFinite(expiry) ||
      expiry <= Date.now() + 5_000 || expiry > Date.now() + 5 * 60_000 ||
      grantedUrl.protocol !== "https:" || grantedUrl.origin !== artifactUrl.origin ||
      grantedUrl.pathname !== artifactUrl.pathname || grantedUrl.hash ||
      (manifest.channel === "HOME_QA" && (grantedUrl.searchParams.get("X-Amz-Expires") !== "120" ||
        !grantedUrl.searchParams.has("X-Amz-Signature")))) fail("EDGE_UPDATE_DOWNLOAD_AUTH_INVALID");
    url = grant.url;
  }
  await download({ url, destination, expectedSize: manifest.artifact_size, expectedSha256: manifest.artifact_sha256 });
  const result = await manager.apply({ manifest, artifactBytes: readFileSync(destination) });
  await reportEdgeUpdateStatus(cloudRequest, manifest.release_id, result);
  return result;
}
