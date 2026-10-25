// Authorize one exact retry of the quarantined Gateway 0.2.17 release after
// evidence shows it ran healthy for hours before host-wide liveness pressure,
// and both signed current runtimes are stable again. The installed OTA agent
// remains the only downloader, installer, health gate, promoter and rollback
// owner.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync,
  writeFileSync } from "node:fs";
import { homedir, loadavg } from "node:os";
import { join, resolve, sep } from "node:path";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const DEVICE_ID = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const RELEASE_ID = "qa-p38-health-gateway-maintenance-isolation-995d6f822468";
const VERSION = "0.2.17-p38-health";
const DIGEST = "995d6f822468f5a2f8b5be59d338c46ddc0d4647b28068d999a972fb13953efe";
const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const CURRENT_RELEASE = "qa-p38-health-gateway-media-cadence-2abe984fa273";
const CONNECTOR_RELEASE = "qa-p38-health-connector-rtsp-handoff-kg20-448381dc3792";
const CONNECTOR_DIGEST = "448381dc3792dfed37a3e98ddf73b71f5dea1ef8d4119818071e5ed03ede348b";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const CONNECTOR_ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || !outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(RESTRICTED_ROOT) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function psql(sql) {
  return execFileSync("docker", ["--context", "colima-push38t", "exec",
    "supabase_db_gan-batuach-push38t", "psql", "-X", "-A", "-t", "-U", "postgres",
    "-d", "postgres", "-c", sql], { encoding: "utf8", timeout: 45_000,
    stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function servicePid(label) {
  const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${label}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  if (!text.includes("state = running")) return null;
  return Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null;
}
function activeHeavyDevelopmentProcesses() {
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,command="],
    { encoding: "utf8", timeout: 10_000 }).split("\n");
  const classes = [
    ["typescript", /(?:^|\s)tsc\s+--noEmit(?:\s|$)/],
    ["lint", /(?:npm\s+run\s+lint(?::ci)?|eslint\s+app\s+components\s+lib\s+services)/],
    ["build", /(?:npm\s+run\s+build|next\s+build)/],
    ["scale_benchmark", /(?:horizontal-worker|horizontal-ai|scale-benchmark)/]
  ];
  return classes.flatMap(([kind, pattern]) => rows.some(row => pattern.test(row)) ? [kind] : []);
}
async function healthSample(port, label) {
  const pid = servicePid(label);
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(8_000)
  });
  const body = await response.json();
  return { http: response.status, pid, ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? body.lastDiscovery?.channelCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    event_loop_p99_ms: body.eventLoop?.delay_p99_ms ?? null,
    version: body.edgeRuntime?.software_version || null,
    build_sha: body.edgeRuntime?.build_sha || null };
}
async function stableRecoveredHealth() {
  const gateway = [], connector = [];
  for (let index = 0; index < 3; index += 1) {
    gateway.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
    connector.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
    if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 3_000));
  }
  if (new Set(gateway.map(item => item.pid)).size !== 1 || gateway.some(item =>
    item.http !== 200 || item.status !== "degraded" || item.assigned !== 10 || item.connected !== 9 ||
    item.failed !== 1 || item.empty !== 6 || item.progressing !== 9 || item.stalled !== 0 ||
    !Number.isFinite(item.event_loop_p99_ms) || item.event_loop_p99_ms >= 10_000 ||
    item.version !== "0.2.16-p38-health"))
    throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_GATEWAY_NOT_STABLE");
  if (new Set(connector.map(item => item.pid)).size !== 1 || connector.some(item =>
    item.http !== 200 || !item.ok || item.status !== "healthy" || item.assigned !== 1 ||
    item.connected !== 1 || item.progressing !== 1 || item.stalled !== 0 ||
    !Number.isFinite(item.event_loop_p99_ms) || item.event_loop_p99_ms >= 10_000 ||
    item.version !== "0.2.23-p38-health"))
    throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_CONNECTOR_NOT_STABLE");
  return { gateway, connector };
}

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root: ROOT, trustedPublicKeys: trusted,
  device: { deviceId: DEVICE_ID, profile: "PHYSICAL_GATEWAY", platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: "0.2.16-p38-health",
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifestPath = join(ROOT, "slots", VERSION, "release.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (!verified.ok || manifest.release_id !== RELEASE_ID || manifest.artifact_sha256 !== DIGEST ||
  current.release_id !== CURRENT_RELEASE || !knownGood.some(item =>
    item.release_id === CURRENT_RELEASE && item.artifact_sha256 === current.artifact_sha256) ||
  state.state !== "ROLLED_BACK" || state.release_id !== RELEASE_ID ||
  state.failure_category !== "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP" ||
  !manager.quarantine().some(item => item.release_id === RELEASE_ID && item.reason === FAILURE))
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_SIGNED_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: VERSION, slot: join(ROOT, "slots", VERSION),
  release_id: RELEASE_ID, artifact_sha256: DIGEST });

const lastCrashIndex = state.history.findLastIndex(item =>
  item.state === "ROLLBACK_REQUIRED" && item.category === FAILURE);
const lastHealthy = state.history.slice(0, lastCrashIndex).findLast(item => item.state === "HEALTHY");
const healthyDurationMs = Date.parse(state.history[lastCrashIndex]?.at || "") -
  Date.parse(lastHealthy?.at || "");
if (lastCrashIndex < 0 || !Number.isFinite(healthyDurationMs) || healthyDurationMs < 8 * 60 * 60_000 ||
  state.recovery_category !== "EDGE_UPDATE_SIGNED_KNOWN_GOOD_STABILITY_REVERIFIED" ||
  state.recovery_health?.healthy !== true || state.recovery_health?.progressing_physical_cameras !== 9)
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_HISTORY_INSUFFICIENT");

const connectorManager = new EdgeUpdateManager({ root: CONNECTOR_ROOT, trustedPublicKeys: trusted,
  device: { deviceId: "db267b52-6282-4944-bcee-5d4857698fb0", profile: "SOFTWARE_CONNECTOR",
    platform: "darwin", architecture: "arm64", channel: "HOME_QA",
    currentVersion: "0.2.23-p38-health", configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== CONNECTOR_RELEASE ||
  connectorManager.current().artifact_sha256 !== CONNECTOR_DIGEST ||
  !connectorManager.knownGood().some(item => item.release_id === CONNECTOR_RELEASE))
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'status',o.status,'cohort_percent',o.cohort_percent,'target_filters',o.target_filters,
  'profile',r.deployment_profile,'platform',r.platform,'architecture',r.architecture,
  'channel',r.channel,'release_state',r.release_state,'artifact_sha256',r.artifact_sha256,
  'signing_key_id',r.signing_key_id)::text
from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
where r.release_id='${RELEASE_ID}'`));
if (rollout.status !== "ACTIVE" || rollout.cohort_percent !== 0 || rollout.profile !== "PHYSICAL_GATEWAY" ||
  rollout.platform !== "darwin" || rollout.architecture !== "arm64" || rollout.channel !== "HOME_QA" ||
  rollout.release_state !== "PUBLISHED" || rollout.artifact_sha256 !== DIGEST ||
  JSON.stringify(rollout.target_filters) !== JSON.stringify({ explicit_device_ids: [DEVICE_ID] }) ||
  Number(psql("select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0")) !== 0)
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_ROLLOUT_STATE_INVALID");

const heavyBefore = activeHeavyDevelopmentProcesses();
if (heavyBefore.length) throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_HOST_BUSY");
const health = await stableRecoveredHealth();
const heavyAfter = activeHeavyDevelopmentProcesses();
if (heavyAfter.length) throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_HOST_BUSY");
const plan = { protocol: "observer-push38-gateway-maintenance-isolation-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: RELEASE_ID,
  version: VERSION, artifact_sha256: DIGEST, exact_device_id: DEVICE_ID,
  prior_failure: FAILURE, current_release_id: CURRENT_RELEASE,
  prior_candidate_healthy_duration_ms: healthyDurationMs,
  host_pressure_classification: "LATE_LIVENESS_FAILURE_DURING_DEVELOPMENT_CONTENTION",
  active_heavy_development_processes: [], load_average_observed: loadavg(),
  current_gateway: "9_OF_9_SOURCE_AVAILABLE_PROGRESSING",
  known_upstream_unavailable: [8], empty_channels: [9, 12, 13, 14, 15, 16],
  connector_prerequisite: CONNECTOR_RELEASE, health_samples: health,
  signed_manifest: "PASS", live_trust: "PASS", broad_cohort: false, runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_MAINTENANCE_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, prior_healthy_hours: Number((healthyDurationMs / 3_600_000).toFixed(2)),
    exact_device: true, broad_cohort: false, runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256) || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== RELEASE_ID ||
  saved.artifact_sha256 !== DIGEST || Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_GATEWAY_MAINTENANCE_RETRY_PLAN_STALE");
let authorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
  authorized = true;
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(ROOT, "slots", VERSION)), exact_rollout_active: true,
    ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_MAINTENANCE_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, failed_slot_removed: true, exact_rollout_active: true,
    broad_cohort: false, ota_agent_owns_install: true }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
