import { readFileSync } from "node:fs";
import { EdgeUpdateManager, downloadEdgeUpdateArtifact } from "./edge-update-manager.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }

/** Shared outbound-first update cycle for Software Connector, Physical Gateway and future Enterprise Edge. */
export async function runEdgeUpdateCycle({
  root, trustedPublicKeys, device, cloudRequest, adapter, healthCheck, download = downloadEdgeUpdateArtifact,
  onTransition = () => {}
}) {
  if (typeof cloudRequest !== "function") fail("EDGE_UPDATE_CLOUD_CLIENT_REQUIRED");
  const manager = new EdgeUpdateManager({ root, trustedPublicKeys, device, adapter, healthCheck });
  if (!manager.current().slot) manager.initializeKnownGood(device.currentVersion, device.buildSha);
  const plan = await cloudRequest({ method: "GET", path: "/api/video-gateway/edge-updates", operation: "UPDATE_READ",
    query: { platform: device.platform, architecture: device.architecture, profile: device.profile,
      current_version: manager.current().version, config_version: device.configVersion, channel: device.channel } });
  if (!plan?.manifest) return manager.status();
  const manifest = plan.manifest;
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
  await cloudRequest({ method: "POST", path: "/api/video-gateway/edge-updates", operation: "UPDATE_STATUS",
    body: { release_id: manifest.release_id, state: result.state, current_version: result.current_version,
      known_good_version: result.known_good_version, failure_category: result.failure_category || null } });
  return result;
}
