// Authorize one exact retry of the signed Connector remediation after its
// delayed rollback has been reconciled. The normal OTA agent remains the only
// installer and keeps the signed transition as the rollback target.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

const DEVICE_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const RELEASE_ID = "qa-p38-health-connector-startup-d44b7e4262f9";
const VERSION = "0.2.12-p38-health";
const ARTIFACT_SHA256 = "d44b7e4262f9a7c9051a8c3e15258c612791546b1bfeaddf6f95c04ee706d388";
const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const CURRENT_RELEASE = "qa-connector-legacy-transition-v2-6e7988808b05";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const CONFIG_PATH = join(ROOT, "agent-config.json");
const AGENT_LOG = join(ROOT, "agent.out.log");
const SLOT = join(ROOT, "slots", VERSION);
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "preflight" : process.argv.includes("--apply") ? "apply" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode) throw new Error("P38_CONNECTOR_CRASH_RETRY_MODE_REQUIRED");
if (!outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_CRASH_RETRY_RESTRICTED_NEW_OUTPUT_REQUIRED");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !realpathSync(path).startsWith(RESTRICTED_ROOT) || lstatSync(path).isSymbolicLink() ||
    (statSync(path).mode & 0o077) !== 0) throw new Error("P38_CONNECTOR_CRASH_RETRY_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function psql(sql) {
  return execFileSync("docker", ["--context", "colima-push38t", "exec", "supabase_db_gan-batuach-push38t",
    "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c", sql],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

if (!existsSync(CONFIG_PATH) || lstatSync(CONFIG_PATH).isSymbolicLink() ||
  (statSync(CONFIG_PATH).mode & 0o077) !== 0 || realpathSync(CONFIG_PATH) !== CONFIG_PATH)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
if (config.profile !== "SOFTWARE_CONNECTOR" || config.deviceId !== DEVICE_ID ||
  config.channel !== "HOME_QA" || config.managedRoot !== ROOT || config.port !== 18083 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_CONNECTOR_CRASH_RETRY_CONFIG_MISMATCH");
const certificate = config.qaTlsCaPath;
if (!existsSync(certificate) || lstatSync(certificate).isSymbolicLink() || !lstatSync(certificate).isFile() ||
  realpathSync(certificate) !== certificate || (lstatSync(certificate).mode & 0o022) !== 0 ||
  sha(readFileSync(certificate)) !== config.qaTlsCaSha256)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_TLS_CERTIFICATE_INVALID");

const trustedPublicKeys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manifest = JSON.parse(readFileSync(join(SLOT, "release.json"), "utf8"));
const verification = verifyEdgeUpdateManifest(manifest, trustedPublicKeys);
const runtimeFile = readFileSync(join(SLOT,
  "runtime/Digital Observer.app/Contents/Resources/runtime/services/video-gateway/http-runtime.mjs"), "utf8");
const undiciPackage = JSON.parse(readFileSync(join(SLOT,
  "runtime/Digital Observer.app/Contents/Resources/runtime/node_modules/undici/package.json"), "utf8"));
if (!verification.ok || manifest.release_id !== RELEASE_ID || manifest.version !== VERSION ||
  manifest.artifact_sha256 !== ARTIFACT_SHA256 || !runtimeFile.includes('EDGE_HTTP_RUNTIME_VERSION = "8.10.2"') ||
  !runtimeFile.includes("install();") || undiciPackage.version !== "8.10.2")
  throw new Error("P38_CONNECTOR_CRASH_RETRY_SIGNED_RUNTIME_INVALID");

const manager = new EdgeUpdateManager({ root: ROOT, trustedPublicKeys,
  device: { deviceId: DEVICE_ID, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
const state = manager.status();
const quarantine = manager.quarantine().find(item => item.release_id === RELEASE_ID);
if (manager.current().release_id !== CURRENT_RELEASE || manager.knownGood().length !== 1 ||
  manager.knownGood()[0].release_id !== CURRENT_RELEASE || state.state !== "ROLLED_BACK" ||
  state.release_id !== RELEASE_ID || quarantine?.reason !== FAILURE)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_ROLLBACK_STATE_INVALID");
manager.verifySlot(manager.current());
manager.verifySlot({ version: VERSION, slot: SLOT, release_id: RELEASE_ID, artifact_sha256: ARTIFACT_SHA256 });

const healthyEvents = readFileSync(AGENT_LOG, "utf8").split("\n").filter(Boolean).flatMap(line => {
  try { const event = JSON.parse(line); return event.state === "HEALTHY" && event.release_id === RELEASE_ID ? [event] : []; }
  catch { return []; }
});
const healthyDurationMs = Date.parse(healthyEvents.at(-1)?.at || 0) - Date.parse(healthyEvents[0]?.at || 0);
if (healthyEvents.length < 25 || healthyDurationMs < 25 * 60_000)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_PRIOR_HEALTH_EVIDENCE_INSUFFICIENT");

const launch = () => {
  const text = execFileSync("/bin/launchctl", ["print", "gui/501/com.ganbatuach.software-connector.tapo"],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: text.includes("state = running"), pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null };
};
async function sampleHealth() {
  const service = launch();
  const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("P38_CONNECTOR_CRASH_RETRY_RUNTIME_UNAVAILABLE");
  const body = await response.json();
  return { pid: service.pid, running: service.running, status: body.status || null,
    expected: body.lastDiscovery?.channelCount ?? 0, connected: body.lastDiscovery?.connectedCount ?? 0,
    progressing: body.mediaHeartbeat?.progressingRelays ?? 0, stalled: body.mediaHeartbeat?.stalledRelays ?? 0 };
}
const samples = [];
for (let index = 0; index < 3; index += 1) {
  samples.push(await sampleHealth());
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 3_000));
}
if (samples.some(sample => !sample.running || !sample.pid || sample.expected !== 1) ||
  new Set(samples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_CURRENT_RUNTIME_UNSTABLE");
// The installed OTA agent is the active managed runtime. A second process must
// not sign as a new runtime inside the two-minute clone-protection window.
// Instead require a fresh accepted Ed25519 nonce from that exact active agent.
const freshManagedProof = Number(psql(`select count(*) from public.video_gateway_device_enrollments e
  join public.observer_managed_device_credentials c on c.enrollment_id=e.id
    and c.credential_version=e.credential_version
  where e.gateway_id='${DEVICE_ID}' and e.lifecycle_state='ACTIVE' and e.status='delivered'
    and e.identity_scheme='ED25519_V1' and c.credential_state='ACTIVE'
    and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '2 minutes'
    and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id
      and n.credential_version=e.credential_version and n.observed_at>=now()-interval '2 minutes')`)) > 0;
if (!freshManagedProof)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_DEVICE_AUTH_FAILED");

const rollout = JSON.parse(psql(`select jsonb_build_object('status',o.status,'cohort_percent',o.cohort_percent,
  'target_filters',o.target_filters,'release_state',r.release_state,'artifact_sha256',r.artifact_sha256,
  'signing_key_id',r.signing_key_id)::text from public.observer_edge_rollouts o
  join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'`));
if (rollout.status !== "ACTIVE" || rollout.cohort_percent !== 0 || rollout.release_state !== "PUBLISHED" ||
  rollout.artifact_sha256 !== ARTIFACT_SHA256 || rollout.signing_key_id !== manifest.signing_key_id ||
  JSON.stringify(rollout.target_filters) !== JSON.stringify({ explicit_device_ids: [DEVICE_ID] }) ||
  Number(psql("select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent>0")) !== 0)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_EXACT_ROLLOUT_INVALID");

const plan = { protocol: "observer-push38-connector-crash-retry-v1", generated_at: new Date().toISOString(),
  release_id: RELEASE_ID, version: VERSION, artifact_sha256: ARTIFACT_SHA256,
  previous_failure_category: FAILURE, current_release_id: CURRENT_RELEASE,
  exact_device_id: DEVICE_ID, cohort_percent: 0, signed_manifest: "PASS", live_trust: "PASS",
  managed_device_auth: "PASS", prior_healthy_samples: healthyEvents.length,
  prior_healthy_duration_seconds: Math.floor(healthyDurationMs / 1000),
  protected_http_runtime: { provider: "undici-package", version: undiciPackage.version },
  current_runtime_samples: samples, runtime_writes: 0 };
if (mode === "preflight") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "RETRY_PREFLIGHT_PASS", evidence_sha256: evidenceSha,
    release_id: RELEASE_ID, exact_device: true, broad_cohort: false,
    prior_healthy_samples: healthyEvents.length, runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256) || sha(planBytes) !== planSha256)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_PLAN_PIN_MISMATCH");
const savedPlan = JSON.parse(planBytes);
if (savedPlan.protocol !== plan.protocol || savedPlan.release_id !== RELEASE_ID ||
  savedPlan.artifact_sha256 !== ARTIFACT_SHA256 || Date.now() - Date.parse(savedPlan.generated_at) > 10 * 60_000)
  throw new Error("P38_CONNECTOR_CRASH_RETRY_PLAN_STALE");
const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
  expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
  failed_slot_removed: !existsSync(SLOT), exact_rollout_active: true, runtime_writes: 0,
  ota_agent_owns_install: true };
const evidenceSha = persist(result);
console.log(JSON.stringify({ status: "EXACT_CRASH_RETRY_AUTHORIZED", evidence_sha256: evidenceSha,
  release_id: RELEASE_ID, failed_slot_removed: true, exact_rollout_active: true,
  broad_cohort: false, ota_agent_owns_install: true }));
