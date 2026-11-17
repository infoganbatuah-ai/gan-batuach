// Idempotent interruption recovery for the exact Home Connector transition.
// Uses createConnectorLegacyTransition.recover; never creates a second rollback.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createConnectorLegacyTransition } from "../../services/video-gateway/edge-connector-legacy-transition.mjs";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

if (!process.argv.includes("--recover") || process.argv.includes("--dry-run"))
  throw new Error("P38_CONNECTOR_RECOVERY_EXPLICIT_MODE_REQUIRED");
const id = "db267b52-6282-4944-bcee-5d4857698fb0";
const site = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const journalPath = join(root, "legacy-transition.json");
if (!existsSync(journalPath)) throw new Error("P38_CONNECTOR_RECOVERY_JOURNAL_MISSING");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
if (journal.device_id !== id || journal.state === "RETIRED" ||
  journal.legacy_artifact_sha256 !== "ee82c20a77acb7fd8caf692682569ad53581e9c057b11724845c6d947c5a982a" ||
  journal.transition_artifact_sha256 !== "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a")
  throw new Error("P38_CONNECTOR_RECOVERY_JOURNAL_UNTRUSTED");
const secretDir = join(homedir(), "Library/Application Support/Digital Observer/Tapo Connector/secrets");
const snapshot = () => {
  const device = readFileSync(join(secretDir, "device_gateway_id"), "utf8").trim();
  const observedSite = readFileSync(join(secretDir, "device_observer_site_id"), "utf8").trim();
  const source = readFileSync(join(secretDir, "connector_camera_source_id"), "utf8").trim();
  if (device !== id || observedSite !== site || source !== "7465c0f2-ba57-4299-b22e-f20cedb91c23")
    throw new Error("P38_CONNECTOR_RECOVERY_IDENTITY_CHANGED");
  return { identity_fingerprint: createHash("sha256").update(`${device}|${observedSite}`).digest("hex"),
    binding_fingerprint: createHash("sha256").update(`${device}|${observedSite}|${source}`).digest("hex") };
};
const current = snapshot();
if (current.identity_fingerprint !== journal.identity_fingerprint ||
  current.binding_fingerprint !== journal.binding_fingerprint)
  throw new Error("P38_CONNECTOR_RECOVERY_BINDING_CHANGED");
const label = "com.ganbatuach.software-connector.tapo";
const adapter = createMacOSInstalledEdgeAdapter({ profile: "SOFTWARE_CONNECTOR",
  installedBase: join(homedir(), "Applications"), managedRoot: root,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${label}.plist`),
  label, port: 18083, allowMutations: true,
  approvedArtifactSha256: journal.legacy_artifact_sha256 });
const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId: id, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    channel: "INTERNAL", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter, healthCheck: async () => {
    const probe = await adapter.health({ timeoutMs: 10_000 });
    return { process_running: probe.ok && probe.service.running,
      device_authenticated: probe.body?.deviceAuthorization?.status === "ready",
      heartbeat: probe.ok, config_retrieved: probe.body?.lastDiscovery?.channelCount === 1,
      cloud_reachable: probe.body?.deviceAuthorization?.status === "ready", no_crash_loop: probe.ok,
      expected_physical_cameras: 0, progressing_physical_cameras: 0, empty_slots: 0, stalled_streams: 0,
      observed_expected_physical_cameras: 1,
      observed_progressing_physical_cameras: probe.body?.mediaHeartbeat?.progressingRelays ?? 0 };
  } });
const inspect = async () => {
  const probe = await adapter.health({ timeoutMs: 10_000 });
  return { legacy_running: probe.ok && probe.service.running, ...snapshot() };
};
const transition = createConnectorLegacyTransition({ manager, adapter, inspect,
  verifyContinuity: async ({ before }) => {
    const after = await inspect();
    return after.legacy_running &&
      after.identity_fingerprint === before.identity_fingerprint &&
      after.binding_fingerprint === before.binding_fingerprint;
  } });
const recovered = await transition.recover();
if (!(["ACTION_REQUIRED", "RETIRED"].includes(recovered.state)))
  throw new Error("P38_CONNECTOR_RECOVERY_UNEXPECTED_STATE");
console.log(JSON.stringify({ status: recovered.state, legacy_recovered: recovered.legacy_recovered,
  current_release: manager.current().release_id || null, identity_source_continuity: "PASS" }));
