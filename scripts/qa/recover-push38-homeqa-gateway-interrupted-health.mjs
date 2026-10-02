// Resume only the exact signed Gateway update whose OTA agent was replaced
// during VERIFYING_HEALTH. The canonical manager either promotes that exact
// CURRENT slot after a fresh stable health proof or rolls back to the exact
// signed 0.2.56 KNOWN_GOOD. It never selects or installs another release.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { deriveInstalledEdgeHealth, installedEdgeHealthTimeoutMs,
  waitForInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_EXPLICIT_MODE_REQUIRED");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1] || "") : "";
const restrictedRoot = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted");
if (!outputPath || !outputPath.startsWith(`${restrictedRoot}/`) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_OUTPUT_INVALID");

const expected = Object.freeze({
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  currentReleaseId: "qa-p38-health-gateway-exclusive-acquisition-retry-from-hls-window-86fa5a9253a9",
  currentVersion: "0.2.62-p38-health",
  currentArtifactSha256: "86fa5a9253a9d99ce9ea8f0d2dc192630f98294810cf7b7ade9af13411cfd8bc",
  rollbackReleaseId: "qa-p38-health-gateway-hls-window-direct-59572f35f8cc",
  rollbackVersion: "0.2.56-p38-health",
  rollbackArtifactSha256: "59572f35f8ccb3877566f36c2deaa71a0b56063feffe094f69767e26105fc954"
});
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() ||
  !lstatSync(configPath).isFile() || realpathSync(configPath) !== configPath ||
  (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.profile !== "PHYSICAL_GATEWAY" || config.deviceId !== expected.deviceId ||
  config.channel !== "HOME_QA" || config.managedRoot !== root || config.port !== 18082 ||
  config.expectedPhysicalCameras !== 9 || config.configuredPhysicalCameras !== 10 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_CONFIG_MISMATCH");

const tlsChild = process.argv.includes("--tls-child");
if (apply && !tlsChild) {
  const certificate = config.qaTlsCaPath;
  if (!existsSync(certificate) || lstatSync(certificate).isSymbolicLink() ||
    !lstatSync(certificate).isFile() || realpathSync(certificate) !== certificate ||
    (lstatSync(certificate).mode & 0o022) !== 0 ||
    createHash("sha256").update(readFileSync(certificate)).digest("hex") !== config.qaTlsCaSha256)
    throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_TLS_INVALID");
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--tls-child"],
    { env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate }, stdio: "inherit", timeout: 720_000 });
  process.exit(0);
}
if (apply && (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath)))
  throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_TLS_PROCESS_INVALID");
if (apply) {
  try {
    const agent = execFileSync("/bin/launchctl", ["print",
      `gui/${process.getuid()}/com.ganbatuach.video-gateway.ota-agent`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
    if (agent.includes("state = running"))
      throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_AGENT_MUST_BE_PAUSED");
  } catch (error) {
    if (error?.message === "P38_GATEWAY_INTERRUPTED_HEALTH_AGENT_MUST_BE_PAUSED") throw error;
  }
}

const adapter = createMacOSInstalledEdgeAdapter({ profile: config.profile,
  installedBase: config.installedBase, managedRoot: root,
  launchAgentPath: config.launchAgentPath, label: config.label, port: config.port,
  allowMutations: apply, approvedArtifactSha256: config.baselineArtifactSha256 });
const trustedPublicKeys = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const store = apply ? createEdgeSecretStoreSync({ secretDir: config.secretDir }) : null;
let managedSessionVerified = false;
const readHealth = async ({ timeoutMs }) => {
  const probe = await adapter.health({ timeoutMs });
  if (!managedSessionVerified) managedSessionVerified = await softwareConnectorDeviceSession(store).then(session =>
    session.authMode === "ED25519_V1" && session.gatewayId === expected.deviceId, () => false);
  return deriveInstalledEdgeHealth({ profile: config.profile,
    expected: config.expectedPhysicalCameras, configured: config.configuredPhysicalCameras,
    probe, cloudReachable: managedSessionVerified,
    managedDeviceAuthenticated: managedSessionVerified });
};
const healthCheck = async ({ rollback = false } = {}) =>
  waitForInstalledEdgeHealth({ readHealth, runtimePid: adapter.runtimePid, rollback,
    timeoutMs: installedEdgeHealthTimeoutMs({ profile: config.profile, rollback }) });
const manager = new EdgeUpdateManager({ root, trustedPublicKeys,
  device: { deviceId: expected.deviceId, profile: config.profile, platform: "darwin",
    architecture: process.arch, channel: config.channel, currentVersion: expected.rollbackVersion,
    configVersion: config.configVersion || 1, revoked: false }, adapter, healthCheck });
const before = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (before.state !== "VERIFYING_HEALTH" || before.release_id !== expected.currentReleaseId ||
  before.target_version !== expected.currentVersion || current.release_id !== expected.currentReleaseId ||
  current.version !== expected.currentVersion || current.artifact_sha256 !== expected.currentArtifactSha256 ||
  !knownGood.some(item => item.release_id === expected.rollbackReleaseId &&
    item.version === expected.rollbackVersion &&
    item.artifact_sha256 === expected.rollbackArtifactSha256))
  throw new Error("P38_GATEWAY_INTERRUPTED_HEALTH_STATE_MISMATCH");
manager.verifySlot(current);
manager.verifySlot(knownGood.find(item => item.release_id === expected.rollbackReleaseId));

if (dryRun) {
  const evidence = { protocol: "observer-push38-interrupted-health-recovery-v1",
    generated_at: new Date().toISOString(), mode: "DRY_RUN", status: "PASS",
    current_release: current.release_id, rollback_release: expected.rollbackReleaseId,
    state: before.state, action: "RESUME_EXACT_HEALTH_THEN_PROMOTE_OR_CANONICAL_ROLLBACK",
    release_selected: false, artifact_installed: false, runtime_restarted: false };
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ ...evidence,
    evidence_sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex") }));
  process.exit(0);
}

const result = await manager.recoverInterruptedHealthVerification();
const evidence = { protocol: "observer-push38-interrupted-health-recovery-v1",
  generated_at: new Date().toISOString(), mode: "APPLY", status: result.state,
  current_release: manager.current().release_id,
  known_good_release: manager.knownGood().at(-1)?.release_id || null,
  target_release: expected.currentReleaseId, rollback_release: expected.rollbackReleaseId,
  recovery_category: result.recovery_category || null,
  failure_category: result.failure_category || null,
  managed_session_verified: managedSessionVerified,
  runtime_pid: adapter.runtimePid(), release_selected: false, artifact_installed: false };
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ ...evidence,
  evidence_sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex") }));
