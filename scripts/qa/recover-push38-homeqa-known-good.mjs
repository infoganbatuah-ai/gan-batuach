// Reconcile only the exact signed Connector CURRENT/KNOWN_GOOD slot after a
// late crash-guard terminal. This command never selects, installs, promotes or
// restarts a release; it only clears ACTION_REQUIRED after two stable proofs.
import { homedir } from "node:os";
import { join } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";
import { deriveInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

if (!process.argv.includes("--recover-known-good"))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_EXPLICIT_MODE_REQUIRED");

const deviceId = "db267b52-6282-4944-bcee-5d4857698fb0";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const secretDir = join(root, "home-qa-device-secrets");
const label = "com.ganbatuach.software-connector.tapo";
const adapter = createMacOSInstalledEdgeAdapter({ profile: "SOFTWARE_CONNECTOR",
  installedBase: join(homedir(), "Applications"), managedRoot: root,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${label}.plist`),
  label, port: 18083, allowMutations: true,
  approvedArtifactSha256: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a" });
const store = createEdgeSecretStoreSync({ secretDir });
const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter, healthCheck: async () => {
    const session = await softwareConnectorDeviceSession(store);
    if (session.authMode !== "ED25519_V1" || session.gatewayId !== deviceId)
      throw new Error("P38_HOME_QA_MANAGED_SESSION_NOT_VERIFIED");
    const probe = await adapter.health({ timeoutMs: 5_000 });
    return deriveInstalledEdgeHealth({ profile: "SOFTWARE_CONNECTOR", expected: 1, configured: 1,
      probe, cloudReachable: true, managedDeviceAuthenticated: true });
  } });

const before = manager.status();
if (before.state !== "ACTION_REQUIRED" || before.failure_category !== "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP" ||
  manager.current().release_id !== "qa-connector-legacy-transition-v2-6e7988808b05")
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_STATE_MISMATCH");
const recovered = await manager.recoverKnownGoodCrashLoopAfterStability();
console.log(JSON.stringify({ status: recovered.state, recovery_category: recovered.recovery_category,
  current_release: manager.current().release_id, runtime_restarted: false, release_promoted: false }));
