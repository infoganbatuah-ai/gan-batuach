// Reconcile only the exact signed Connector CURRENT/KNOWN_GOOD slot after a
// late crash-guard terminal. This command never selects, installs, promotes or
// restarts a release; it only clears ACTION_REQUIRED after two stable proofs.
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { deriveInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

if (!process.argv.includes("--recover-known-good"))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_RECOVERY_EXPLICIT_MODE_REQUIRED");

const deviceId = "db267b52-6282-4944-bcee-5d4857698fb0";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const label = "com.ganbatuach.software-connector.tapo";
const adapter = createMacOSInstalledEdgeAdapter({ profile: "SOFTWARE_CONNECTOR",
  installedBase: join(homedir(), "Applications"), managedRoot: root,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${label}.plist`),
  label, port: 18083, allowMutations: true,
  approvedArtifactSha256: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a" });
const recentInstalledAgentProof = () => Number(execFileSync("docker", ["--context", "colima-push38t", "exec",
  "supabase_db_gan-batuach-push38t", "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c",
  `select count(*) from public.video_gateway_device_enrollments e
   join public.observer_managed_device_credentials c on c.enrollment_id=e.id
   join public.observer_managed_device_auth_nonces n on n.enrollment_id=e.id
     and n.credential_version=c.credential_version
   where e.gateway_id='${deviceId}' and e.lifecycle_state='ACTIVE'
     and e.identity_scheme='ED25519_V1' and e.credential_version=1
     and c.credential_state='ACTIVE' and e.active_runtime_instance_id is not null
     and e.last_seen_at >= now()-interval '10 minutes'
     and n.observed_at >= now()-interval '10 minutes';`],
{ encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] }).trim()) > 0;
const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter, healthCheck: async () => {
    if (!recentInstalledAgentProof()) throw new Error("P38_HOME_QA_INSTALLED_AGENT_PROOF_NOT_RECENT");
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
