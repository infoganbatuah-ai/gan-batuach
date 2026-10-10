// Clear stale failure metadata only after the exact signed Connector retry is
// already HEALTHY and promoted. This command never restarts or changes runtime.
import { homedir } from "node:os";
import { join } from "node:path";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

if (!process.argv.includes("--apply")) throw new Error("P38_CONNECTOR_HEALTHY_RECONCILIATION_EXPLICIT_MODE_REQUIRED");
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId: "db267b52-6282-4944-bcee-5d4857698fb0", profile: "SOFTWARE_CONNECTOR",
    platform: "darwin", architecture: "arm64", channel: "HOME_QA",
    currentVersion: "0.2.12-p38-health", configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
if (manager.current().release_id !== "qa-p38-health-connector-startup-d44b7e4262f9" ||
  manager.status().state !== "HEALTHY") throw new Error("P38_CONNECTOR_HEALTHY_RECONCILIATION_STATE_MISMATCH");
const result = manager.reconcileHealthyStatusMetadata();
console.log(JSON.stringify({ status: result.state, release_id: manager.current().release_id,
  stale_failure_metadata_cleared: result.failure_category === null,
  runtime_restarted: false, release_promoted: false }));
