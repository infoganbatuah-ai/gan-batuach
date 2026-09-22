// Recover only the exact AWS-trusted Gateway CURRENT/KNOWN_GOOD slot after a
// failed remediation rollback left the manager in ACTION_REQUIRED. This does
// not select, install, or promote a release. It repeats the existing adapter's
// idempotent service handoff to the already-pinned signed slot, then invokes
// the canonical rollback reconciliation path after stable health proof.
import "../../services/video-gateway/http-runtime.mjs";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import {
  deriveInstalledEdgeHealth,
  waitForInstalledEdgeHealth
} from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { EdgeUpdateManager, edgeRollbackRecoveryGate } from "../../services/video-gateway/edge-update-manager.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_EXPLICIT_MODE_REQUIRED");

const expected = Object.freeze({
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-legacy-gateway-91bf6814075f",
  artifactSha256: "91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d",
  failedReleaseId: "qa-p38-health-gateway-6c9d08327ec6",
  failedVersion: "0.2.9-p38-health"
});
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() ||
  !lstatSync(configPath).isFile() || (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const exact = {
  profile: "PHYSICAL_GATEWAY", deviceId: expected.deviceId, managedRoot: root,
  installedBase: join(homedir(), ".local/share/gan-batuach/video-gateway"),
  launchAgentPath: join(homedir(), "Library/LaunchAgents/com.ganbatuach.video-gateway.plist"),
  label: "com.ganbatuach.video-gateway", port: 18082, expectedPhysicalCameras: 8,
  configuredPhysicalCameras: 10, channel: "HOME_QA", baselineArtifactSha256: expected.artifactSha256,
  secretDir: join(root, "home-qa-device-secrets")
};
for (const [key, value] of Object.entries(exact)) {
  if (config[key] !== value) throw new Error(`P38_GATEWAY_ROLLBACK_RECOVERY_CONFIG_${key.toUpperCase()}_MISMATCH`);
}
if (realpathSync(root) !== root || realpathSync(config.secretDir) !== config.secretDir)
  throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_SCOPE_UNSAFE");

const trustedPublicKeys = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH
}).trustedPublicKeys;
const adapter = createMacOSInstalledEdgeAdapter({
  profile: config.profile, installedBase: config.installedBase, managedRoot: root,
  launchAgentPath: config.launchAgentPath, label: config.label, port: config.port,
  allowMutations: apply, approvedArtifactSha256: expected.artifactSha256
});
// Dry-run must remain genuinely read-only. The secure store constructor
// normalizes directory permissions, so instantiate it only in explicit apply.
const store = apply ? createEdgeSecretStoreSync({ secretDir: config.secretDir }) : null;
let managedSessionVerified = false;
const readHealth = async ({ timeoutMs = 5_000 } = {}) => {
  const probe = await adapter.health({ timeoutMs });
  if (!store) throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_SECRET_STORE_REQUIRED");
  if (!managedSessionVerified) managedSessionVerified = await softwareConnectorDeviceSession(store).then(session =>
    session.authMode === "ED25519_V1" && session.gatewayId === expected.deviceId, () => false);
  return deriveInstalledEdgeHealth({ profile: config.profile, expected: config.expectedPhysicalCameras,
    configured: config.configuredPhysicalCameras, probe, cloudReachable: managedSessionVerified,
    managedDeviceAuthenticated: managedSessionVerified });
};
const manager = new EdgeUpdateManager({ root, trustedPublicKeys,
  device: { deviceId: expected.deviceId, profile: config.profile, platform: "darwin",
    architecture: process.arch, channel: config.channel, currentVersion: "0.1.0-legacy",
    configVersion: config.configVersion || 1, revoked: false },
  adapter, healthCheck: readHealth });
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (state.state !== "ACTION_REQUIRED" || state.failure_category !== "EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY" ||
  state.release_id !== expected.failedReleaseId || state.target_version !== expected.failedVersion ||
  current.release_id !== expected.releaseId || current.artifact_sha256 !== expected.artifactSha256 ||
  !knownGood.some(item => item.release_id === expected.releaseId &&
    item.artifact_sha256 === expected.artifactSha256))
  throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_STATE_MISMATCH");
manager.verifySlot(current);
const failedSlot = join(root, "slots", expected.failedVersion);
if (!existsSync(failedSlot)) throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_FAILED_SLOT_MISSING");
manager.verifySlot({ version: expected.failedVersion, slot: failedSlot,
  release_id: expected.failedReleaseId,
  artifact_sha256: JSON.parse(readFileSync(join(failedSlot, "release.json"), "utf8")).artifact_sha256 });

if (dryRun) {
  console.log(JSON.stringify({ status: "PASS", mode: "DRY_RUN", current_release: current.release_id,
    failed_release: state.release_id, recovery: "RESTART_EXACT_SIGNED_CURRENT_THEN_CANONICAL_RECONCILE",
    release_selected: false, release_promoted: false, source_or_identity_mutation: false }));
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(current.slot, "release.json"), "utf8"));
await adapter.restart({ slot: current.slot, manifest, rollback: true });
const stable = await waitForInstalledEdgeHealth({ readHealth, runtimePid: adapter.runtimePid,
  rollback: true, timeoutMs: 90_000, intervalMs: 3_000, probeTimeoutMs: 5_000, stableSamples: 2 });
if (!edgeRollbackRecoveryGate(stable).healthy)
  throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_RUNTIME_UNHEALTHY");
const recovered = await manager.recoverActionRequiredRollback();
if (recovered.state !== "ROLLED_BACK" || manager.current().release_id !== expected.releaseId)
  throw new Error("P38_GATEWAY_ROLLBACK_RECOVERY_RECONCILE_FAILED");
console.log(JSON.stringify({ status: "PASS", mode: "APPLY", update_state: recovered.state,
  current_release: manager.current().release_id, recovery_category: recovered.recovery_category,
  managed_session_verified: managedSessionVerified, runtime_pid: adapter.runtimePid(),
  release_selected: false, release_promoted: false, source_or_identity_mutation: false }));
