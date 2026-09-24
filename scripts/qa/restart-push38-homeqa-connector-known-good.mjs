// Restart only the exact signed Connector CURRENT/KNOWN_GOOD slot when its
// media event loop is liveness-starved, then delegate terminal-state clearing
// to the existing known-good recovery command. No release selection occurs.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

if (!process.argv.includes("--restart-exact-known-good"))
  throw new Error("P38_CONNECTOR_KNOWN_GOOD_RESTART_EXPLICIT_MODE_REQUIRED");

const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const label = "com.ganbatuach.software-connector.tapo";
const releaseId = "qa-p38-health-connector-parent-exit-f7dba974e80f";
const artifactSha256 = "f7dba974e80fc7e70bef0584744379b09ef4c0e8161eb13c32cea6118a4a55fd";
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() ||
  !lstatSync(configPath).isFile() || realpathSync(configPath) !== configPath ||
  (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_CONNECTOR_KNOWN_GOOD_RESTART_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.profile !== "SOFTWARE_CONNECTOR" || config.channel !== "HOME_QA" ||
  config.managedRoot !== root || config.port !== 18083)
  throw new Error("P38_CONNECTOR_KNOWN_GOOD_RESTART_CONFIG_MISMATCH");

const adapter = createMacOSInstalledEdgeAdapter({ profile: "SOFTWARE_CONNECTOR",
  installedBase: join(homedir(), "Applications"), managedRoot: root,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${label}.plist`),
  label, port: 18083, allowMutations: true, approvedArtifactSha256: artifactSha256 });
const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId: config.deviceId, profile: "SOFTWARE_CONNECTOR", platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: "0.2.14-p38-health",
    configVersion: 4, revoked: false },
  adapter, healthCheck: async () => ({}) });
const state = manager.status();
const current = manager.current();
if (state.state !== "ACTION_REQUIRED" || state.failure_category !== "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP" ||
  current.release_id !== releaseId || current.artifact_sha256 !== artifactSha256 ||
  !manager.knownGood().some(item => item.release_id === releaseId && item.artifact_sha256 === artifactSha256))
  throw new Error("P38_CONNECTOR_KNOWN_GOOD_RESTART_STATE_MISMATCH");
const manifest = manager.verifySlot(current);
await adapter.restart({ slot: current.slot, manifest, rollback: true });
// launchd discovery required about 30 seconds on the real host and the
// recovered legacy event loop needed an additional bounded warm-up period.
const probe = await adapter.health({ timeoutMs: 90_000 });
if (!probe.ok) throw new Error("P38_CONNECTOR_KNOWN_GOOD_RESTART_UNHEALTHY");
execFileSync(process.execPath, [fileURLToPath(new URL("./recover-push38-homeqa-known-good.mjs", import.meta.url)),
  "--recover-known-good"], { stdio: "inherit", timeout: 180_000 });
console.log(JSON.stringify({ status: "EXACT_SIGNED_KNOWN_GOOD_RESTARTED",
  release_id: releaseId, runtime_restarted: true, release_selected: false,
  release_installed: false, release_promoted: false }));
