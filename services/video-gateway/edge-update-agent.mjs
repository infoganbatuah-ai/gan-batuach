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
  if (!manager.current().slot || !manager.knownGood().length) fail("EDGE_UPDATE_SIGNED_BOOTSTRAP_REQUIRED");
  const plan = await cloudRequest({ method: "GET", path: "/api/video-gateway/edge-updates", operation: "UPDATE_READ",
    query: { platform: device.platform, architecture: device.architecture, profile: device.profile,
      current_version: manager.current().version, config_version: device.configVersion, channel: device.channel } });
  if (!plan?.manifest) return manager.status();
  const manifest = plan.manifest;
  const destination = `${root}/downloads/${manifest.release_id}.artifact`;
  await onTransition({ state: "DOWNLOADING", release_id: manifest.release_id });
  await download({ url: manifest.artifact_url, destination, expectedSize: manifest.artifact_size, expectedSha256: manifest.artifact_sha256 });
  const result = await manager.apply({ manifest, artifactBytes: readFileSync(destination) });
  await cloudRequest({ method: "POST", path: "/api/video-gateway/edge-updates", operation: "UPDATE_STATUS",
    body: { release_id: manifest.release_id, state: result.state, current_version: result.current_version,
      known_good_version: result.known_good_version, failure_category: result.failure_category || null } });
  return result;
}
