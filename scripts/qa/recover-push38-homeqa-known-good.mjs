// Reconcile only the exact signed Connector CURRENT/KNOWN_GOOD slot after a
// late crash-guard terminal. This command never selects, installs, promotes or
// restarts a release; it only clears ACTION_REQUIRED after two stable proofs.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { deriveInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

if (!process.argv.includes("--recover-known-good"))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_EXPLICIT_MODE_REQUIRED");

const deviceId = "db267b52-6282-4944-bcee-5d4857698fb0";
const currentReleaseId = "qa-p38-health-connector-parent-exit-f7dba974e80f";
const currentArtifactSha256 = "f7dba974e80fc7e70bef0584744379b09ef4c0e8161eb13c32cea6118a4a55fd";
const failedReleaseId = "qa-p38-health-connector-rtsp-session-fb790d87cf53";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const label = "com.ganbatuach.software-connector.tapo";
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() || !lstatSync(configPath).isFile() ||
  realpathSync(configPath) !== configPath || (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.profile !== "SOFTWARE_CONNECTOR" || config.deviceId !== deviceId ||
  config.channel !== "HOME_QA" || config.managedRoot !== root || config.port !== 18083 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_CONFIG_MISMATCH");
const tlsChild = process.argv.includes("--tls-child");
if (!tlsChild) {
  const certificate = config.qaTlsCaPath;
  if (!existsSync(certificate) || lstatSync(certificate).isSymbolicLink() ||
    !lstatSync(certificate).isFile() || realpathSync(certificate) !== certificate ||
    (lstatSync(certificate).mode & 0o022) !== 0 ||
    createHash("sha256").update(readFileSync(certificate)).digest("hex") !== config.qaTlsCaSha256)
    throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_TLS_CERTIFICATE_INVALID");
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--tls-child"],
    { env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate }, stdio: "inherit", timeout: 180_000 });
  process.exit(0);
}
if (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_TLS_PROCESS_INVALID");
const adapter = createMacOSInstalledEdgeAdapter({ profile: "SOFTWARE_CONNECTOR",
  installedBase: join(homedir(), "Applications"), managedRoot: root,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${label}.plist`),
  label, port: 18083, allowMutations: true,
  approvedArtifactSha256: currentArtifactSha256 });
const store = createEdgeSecretStoreSync({ secretDir: config.secretDir });
const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter, healthCheck: async () => {
    const session = await softwareConnectorDeviceSession(store);
    if (session.authMode !== "ED25519_V1" || session.gatewayId !== deviceId)
      throw new Error("P38_HOME_QA_INSTALLED_AGENT_PROOF_NOT_VERIFIED");
    const probe = await adapter.health({ timeoutMs: 5_000 });
    return deriveInstalledEdgeHealth({ profile: "SOFTWARE_CONNECTOR", expected: 1, configured: 1,
      probe, cloudReachable: true, managedDeviceAuthenticated: true });
  } });

const before = manager.status();
const current = manager.current();
if (current.release_id !== currentReleaseId || current.artifact_sha256 !== currentArtifactSha256 ||
  !manager.knownGood().some(item => item.release_id === currentReleaseId &&
    item.artifact_sha256 === currentArtifactSha256) ||
  !((before.state === "ACTION_REQUIRED" && ["EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP",
    "EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY", "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED"].includes(before.failure_category)) ||
    (before.state === "ROLLED_BACK" && before.release_id === failedReleaseId)))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_STATE_MISMATCH");
const recovered = before.state === "ACTION_REQUIRED"
  ? before.failure_category === "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP"
    ? await manager.recoverKnownGoodCrashLoopAfterStability()
    : await manager.recoverActionRequiredRollback()
  : before;
const reconciled = manager.reconcileDelayedRollbackKnownGood();
console.log(JSON.stringify({ status: reconciled.state,
  recovery_category: recovered.recovery_category || reconciled.recovery_category,
  current_release: manager.current().release_id,
  failed_known_good_removed: !manager.knownGood().some(item =>
    item.release_id === failedReleaseId),
  runtime_restarted: false, release_promoted: false }));
