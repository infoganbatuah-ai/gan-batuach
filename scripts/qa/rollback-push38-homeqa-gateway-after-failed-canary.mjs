// Roll back only the exact signed 0.2.79 Gateway whose immutable 15-minute
// canary failed. The existing EdgeUpdateManager owns quarantine, launchd
// handoff, health verification and restoration of signed 0.2.77 known-good.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMacOSInstalledEdgeAdapter } from
  "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { deriveInstalledEdgeHealth, installedEdgeHealthTimeoutMs,
  waitForInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from
  "../../services/video-gateway/edge-release-trust.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_EXPLICIT_MODE_REQUIRED");
const option = name => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
};
const outputPath = resolve(option("output"));
const resultPath = resolve(option("failed-canary-result"));
const checkpointsPath = resolve(option("failed-canary-checkpoints"));
const restrictedRoot = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted");
const restricted = path => path.startsWith(`${restrictedRoot}/`) && existsSync(path) &&
  !lstatSync(path).isSymbolicLink() && lstatSync(path).isFile() && realpathSync(path) === path &&
  (lstatSync(path).mode & 0o077) === 0;
if (!outputPath.startsWith(`${restrictedRoot}/`) || existsSync(outputPath) ||
  !restricted(resultPath) || !restricted(checkpointsPath))
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_EVIDENCE_SCOPE_INVALID");

const expected = Object.freeze({
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  failedReleaseId: "qa-p38-health-gateway-event-loop-cleanup-rb77-83aaf23ce84e",
  failedVersion: "0.2.79-p38-health",
  failedArtifactSha256: "83aaf23ce84efa3c66c9d306592cd010839a7c0d8e3c5d9bc9642d68d72908cd",
  rollbackReleaseId: "qa-p38-health-gateway-device-identity-continuity-63cd90b08ec9",
  rollbackVersion: "0.2.77-p38-health",
  rollbackArtifactSha256: "63cd90b08ec98216c4113b2db9630d32b458fab8cbb9ac98f8582bc415037001",
  resultSha256: "1f45728786eb022e753ca261dcff60440dd236638b8554dc0d869f6dd1820777",
  checkpointsSha256: "54d43daf62276fd643643e46b498965cf2a14acd59aec1e50053622e486855a6"
});
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const resultBytes = readFileSync(resultPath), checkpointBytes = readFileSync(checkpointsPath);
const result = JSON.parse(resultBytes);
const failedCheckpoint = checkpointBytes.toString("utf8").trim().split("\n")
  .map(line => JSON.parse(line)).find(point => point.sequence === 13);
if (sha(resultBytes) !== expected.resultSha256 || sha(checkpointBytes) !== expected.checkpointsSha256 ||
  result.contract !== "observer-reliability-qualification-v1" ||
  result.qualification_stage !== "CANARY" || result.status !== "NOT_DONE" ||
  result.release?.gateway?.software_version !== expected.failedVersion ||
  result.release?.gateway?.build_sha !== "cf279d83d3ebc1f685da8bf7d82c0fb13fb89d13" ||
  result.checkpoints !== 15 || result.elapsed_ms !== 900079 ||
  failedCheckpoint?.dvr?.classification !== "PRODUCT_FAILURE" ||
  failedCheckpoint?.dvr?.available !== 7 || failedCheckpoint?.dvr?.progressing !== 7)
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_PROOF_INVALID");

const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() ||
  !lstatSync(configPath).isFile() || realpathSync(configPath) !== configPath ||
  (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.profile !== "PHYSICAL_GATEWAY" || config.deviceId !== expected.deviceId ||
  config.channel !== "HOME_QA" || config.managedRoot !== root || config.port !== 18082 ||
  config.expectedPhysicalCameras !== 9 || config.configuredPhysicalCameras !== 10 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_CONFIG_MISMATCH");

const tlsChild = process.argv.includes("--tls-child");
if (apply && !tlsChild) {
  if (!existsSync(config.qaTlsCaPath) || lstatSync(config.qaTlsCaPath).isSymbolicLink() ||
    !lstatSync(config.qaTlsCaPath).isFile() || realpathSync(config.qaTlsCaPath) !== config.qaTlsCaPath ||
    (lstatSync(config.qaTlsCaPath).mode & 0o022) !== 0 ||
    sha(readFileSync(config.qaTlsCaPath)) !== config.qaTlsCaSha256)
    throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_TLS_INVALID");
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--tls-child"],
    { env: { ...process.env, NODE_EXTRA_CA_CERTS: config.qaTlsCaPath }, stdio: "inherit",
      timeout: 720_000 });
  process.exit(0);
}
if (apply && (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath)))
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_TLS_PROCESS_INVALID");

const trustedPublicKeys = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const adapter = createMacOSInstalledEdgeAdapter({ profile: config.profile,
  installedBase: config.installedBase, managedRoot: root,
  launchAgentPath: config.launchAgentPath, label: config.label, port: config.port,
  allowMutations: apply, approvedArtifactSha256: expected.failedArtifactSha256 });
// Dry-run stays read-only: secure-store construction can normalize permissions.
const store = apply ? createEdgeSecretStoreSync({ secretDir: config.secretDir }) : null;
let managedSessionVerified = false;
const readHealth = async ({ timeoutMs }) => {
  const probe = await adapter.health({ timeoutMs });
  if (!managedSessionVerified) managedSessionVerified = await softwareConnectorDeviceSession(store)
    .then(session => session.authMode === "ED25519_V1" && session.gatewayId === expected.deviceId,
      () => false);
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
    architecture: process.arch, channel: config.channel, currentVersion: expected.failedVersion,
    configVersion: config.configVersion || 1, revoked: false }, adapter, healthCheck });
const before = manager.status(), current = manager.current(), knownGood = manager.knownGood();
const rollback = knownGood.find(item => item.release_id === expected.rollbackReleaseId);
if (before.state !== "HEALTHY" || current.release_id !== expected.failedReleaseId ||
  current.version !== expected.failedVersion || current.artifact_sha256 !== expected.failedArtifactSha256 ||
  !rollback || rollback.version !== expected.rollbackVersion ||
  rollback.artifact_sha256 !== expected.rollbackArtifactSha256 ||
  manager.quarantine().some(item => item.release_id === expected.failedReleaseId))
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_STATE_MISMATCH");
manager.verifySlot(current);
manager.verifySlot(rollback);

const baseEvidence = { protocol: "observer-push38-gateway-failed-canary-rollback-v1",
  generated_at: new Date().toISOString(), mode: dryRun ? "DRY_RUN" : "APPLY",
  failed_release_id: expected.failedReleaseId, failed_version: expected.failedVersion,
  failed_canary_result_sha256: expected.resultSha256,
  failed_canary_checkpoints_sha256: expected.checkpointsSha256,
  rollback_release_id: expected.rollbackReleaseId, rollback_version: expected.rollbackVersion,
  canonical_manager_action: "rollbackAfterCrashLoop", reason: "EDGE_UPDATE_QUALIFICATION_FAILED",
  release_selected: false, artifact_installed: false, source_or_identity_mutation: false };
if (dryRun) {
  writeFileSync(outputPath, `${JSON.stringify({ ...baseEvidence, status: "PASS",
    intended_action: "QUARANTINE_FAILED_CURRENT_AND_RESTORE_SIGNED_PRIOR_KNOWN_GOOD" }, null, 2)}\n`,
  { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "P38_GATEWAY_FAILED_CANARY_ROLLBACK_DRY_RUN_PASS",
    failed_release_id: expected.failedReleaseId, rollback_release_id: expected.rollbackReleaseId,
    runtime_writes: 0, evidence_sha256: sha(readFileSync(outputPath)) }));
  process.exit(0);
}

const agentPlist = join(homedir(),
  "Library/LaunchAgents/com.ganbatuach.video-gateway.ota-agent.plist");
const agentDomain = `gui/${process.getuid()}/com.ganbatuach.video-gateway.ota-agent`;
const guiDomain = `gui/${process.getuid()}`;
let agentWasLoaded = false;
try {
  execFileSync("/bin/launchctl", ["print", agentDomain], { stdio: "ignore", timeout: 10_000 });
  agentWasLoaded = true;
  execFileSync("/bin/launchctl", ["bootout", guiDomain, agentPlist],
    { stdio: "ignore", timeout: 15_000 });
} catch (error) {
  if (agentWasLoaded) throw error;
}
let rolledBack;
try {
  rolledBack = await manager.rollbackAfterCrashLoop({ reason: "EDGE_UPDATE_QUALIFICATION_FAILED" });
} finally {
  if (agentWasLoaded) {
    execFileSync("/bin/launchctl", ["bootstrap", guiDomain, agentPlist],
      { stdio: "ignore", timeout: 15_000 });
    execFileSync("/bin/launchctl", ["kickstart", agentDomain],
      { stdio: "ignore", timeout: 15_000 });
  }
}
if (rolledBack.state !== "ROLLED_BACK" || manager.current().release_id !== expected.rollbackReleaseId ||
  manager.current().artifact_sha256 !== expected.rollbackArtifactSha256 ||
  manager.knownGood().some(item => item.release_id === expected.failedReleaseId) ||
  !manager.quarantine().some(item => item.release_id === expected.failedReleaseId &&
    item.reason === "EDGE_UPDATE_QUALIFICATION_FAILED"))
  throw new Error("P38_GATEWAY_FAILED_CANARY_ROLLBACK_FAILED");
const evidence = { ...baseEvidence, status: "PASS", update_state: rolledBack.state,
  current_release_after: manager.current().release_id,
  current_version_after: manager.current().version,
  failed_release_quarantined: true, managed_session_verified: managedSessionVerified,
  runtime_pid: adapter.runtimePid(), ota_agent_restored: agentWasLoaded };
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "P38_GATEWAY_FAILED_CANARY_ROLLBACK_PASS",
  current_release: manager.current().release_id, failed_release_quarantined: true,
  evidence_sha256: sha(readFileSync(outputPath)) }));
