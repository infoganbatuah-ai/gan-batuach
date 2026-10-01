// Authorize one exact retry of signed Gateway 0.2.46 after a qualification-only
// controlled pause was interpreted by the crash-loop guard as a runtime crash.
// The installed OTA agent remains the sole downloader, installer, health gate,
// promoter, and rollback owner.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync,
  writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { gatewayRoutineConfirmationLegacyRuntimeAcceptable,
  PUSH38_GATEWAY_ROUTINE_CONFIRMATION as successorItem
} from "../../services/video-gateway/push38-home-qa-gateway-routine-confirmation.mjs";
import { PUSH38_CONNECTOR_RTSP_CADENCE as connectorItem
} from "../../services/video-gateway/push38-home-qa-connector-rtsp-cadence.mjs";

const RELEASE_ID = successorItem.rollbackReleaseId;
const VERSION = successorItem.rollbackVersion;
const DIGEST = successorItem.compatibilityArtifactSha256 ||
  "5cdf47d35b4469f6fb366a28c9837e53bd2c5c5317d17a32504e1f205b22fa1b";
const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const CURRENT_RELEASE_ID = "qa-p38-health-gateway-deadline-budget-42702082e62f";
const CURRENT_VERSION = "0.2.41-p38-health";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
const shadowPath = option("diagnostic-shadow") ? resolve(option("diagnostic-shadow")) : "";
const plistBackupPath = option("plist-backup") ? resolve(option("plist-backup")) : "";
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function docker(args) {
  return execFileSync("docker", ["--context", "colima-push38t", ...args], {
    encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
function psql(sql) {
  return docker(["exec", "supabase_db_gan-batuach-push38t", "psql", "-X", "-A", "-t",
    "-U", "postgres", "-d", "postgres", "-c", sql]);
}
function servicePid(label) {
  const value = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${label}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return value.includes("state = running") ? Number(/\bpid = (\d+)/.exec(value)?.[1] || 0) || null : null;
}
async function healthSample(port, label) {
  const pid = servicePid(label);
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  const lifecycle = body.privateNvrSession || body.recorderSession || body.sessionLifecycle || {};
  return { http: response.status, pid, ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    reason_codes: body.reasonCodes || body.reason_codes || [],
    rotations: lifecycle.rotations ?? 0,
    last_rotation_reason: lifecycle.last_rotation_reason ?? null,
    login_attempts: lifecycle.login_attempts ?? 1,
    login_succeeded: lifecycle.login_succeeded ?? 1,
    proactive_attempts: lifecycle.proactive_attempts ?? 0,
    proactive_succeeded: lifecycle.proactive_succeeded ?? 0,
    active_sessions: lifecycle.active_sessions ?? 1,
    responses_ok: lifecycle.responses_ok ?? 1,
    consecutive_failures: lifecycle.consecutive_failures ?? 0,
    authentication_rejected: lifecycle.authentication_rejected ?? 0,
    version: body.edgeRuntime?.software_version || null,
    build_sha: body.edgeRuntime?.build_sha || null };
}

const shadowBytes = protectedFile(shadowPath);
const plistBytes = protectedFile(plistBackupPath);
const shadow = JSON.parse(shadowBytes);
const plistText = execFileSync("/usr/bin/plutil", ["-p", plistBackupPath], {
  encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
const shadowStartedAt = Date.parse(shadow.started_at || "");
const backupMtime = statSync(plistBackupPath).mtimeMs;
if (shadow.contract !== "observer-push38-bounded-dvr-shadow-v1" ||
  shadow.mode !== "READ_ONLY_ONE_CHANNEL_SHADOW" || shadow.runtime_mutation !== false ||
  shadow.runtime_source !== "SIGNED_RELEASE_BUNDLE" ||
  shadow.signed_release?.release_id !== successorItem.releaseId ||
  shadow.signed_release?.signature_verified !== true || shadow.signed_release?.artifact_verified !== true ||
  shadow.checkpoints?.[0]?.legacy?.status !== "unavailable" ||
  shadow.checkpoints?.at(-1)?.legacy?.http !== 200 || !Number.isFinite(shadowStartedAt) ||
  shadowStartedAt < backupMtime || shadowStartedAt - backupMtime > 10 * 60_000 ||
  !plistText.includes("com.ganbatuach.video-gateway") || !plistText.includes(VERSION))
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_DIAGNOSTIC_ISOLATION_EVIDENCE_INVALID");

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: successorItem.deviceId, profile: successorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: CURRENT_VERSION,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifest = JSON.parse(readFileSync(join(root, "slots", VERSION, "release.json"), "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const quarantined = manager.quarantine().find(item => item.release_id === RELEASE_ID);
const priorRetry = manager.readJson(manager.quarantineRetryPath, []).find(item => item.release_id === RELEASE_ID);
const crashIndex = state.history?.findLastIndex(item => item.state === "ROLLBACK_REQUIRED" &&
  item.category === FAILURE) ?? -1;
const healthyIndex = crashIndex < 0 ? -1 : state.history.slice(0, crashIndex)
  .findLastIndex(item => item.state === "HEALTHY");
const healthyDurationMs = crashIndex < 0 || healthyIndex < 0 ? NaN :
  Date.parse(state.history[crashIndex].at) - Date.parse(state.history[healthyIndex].at);
if (!verified.ok || manifest.release_id !== RELEASE_ID || manifest.version !== VERSION ||
  manifest.artifact_sha256 !== DIGEST || current.release_id !== CURRENT_RELEASE_ID ||
  current.version !== CURRENT_VERSION || !knownGood.some(item => item.release_id === CURRENT_RELEASE_ID &&
    item.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== RELEASE_ID || state.failure_category !== FAILURE ||
  quarantined?.reason !== FAILURE || priorRetry || !Number.isFinite(healthyDurationMs) ||
  healthyDurationMs < 60 * 60_000)
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: VERSION, slot: join(root, "slots", VERSION),
  release_id: RELEASE_ID, artifact_sha256: DIGEST });

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== connectorItem.releaseId ||
  !connectorManager.knownGood().some(item => item.release_id === connectorItem.releaseId))
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'retry_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'),
  'retry_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'),
  'retry_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'),
  'successor_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'successor_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'successor_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0));`));
const exactTargets = { explicit_device_ids: [successorItem.deviceId] };
if (rollout.retry_status !== "ACTIVE" || rollout.retry_cohort !== 0 ||
  JSON.stringify(rollout.retry_targets) !== JSON.stringify(exactTargets) ||
  !["DRAFT", "PAUSED"].includes(rollout.successor_status) || rollout.successor_cohort !== 0 ||
  JSON.stringify(rollout.successor_targets) !== JSON.stringify(exactTargets) || rollout.broad_active !== 0)
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_ROLLOUT_INVALID");

const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 3; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map(item => item.pid)).size !== 1 || gatewaySamples.some(item =>
  item.http !== 200 || item.version !== CURRENT_VERSION ||
  !gatewayRoutineConfirmationLegacyRuntimeAcceptable(item)) ||
  new Set(connectorSamples.map(item => item.pid)).size !== 1 || connectorSamples.some(item =>
    item.http !== 200 || !item.ok || item.assigned !== 1 || item.connected !== 1 ||
    item.progressing !== 1 || item.stalled !== 0 || item.version !== connectorItem.version))
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_RUNTIME_UNSAFE");

const plan = { protocol: "observer-push38-gateway-routine-confirmation-diagnostic-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: RELEASE_ID,
  version: VERSION, artifact_sha256: DIGEST, exact_device_id: successorItem.deviceId,
  previous_failure: FAILURE, current_release_id: CURRENT_RELEASE_ID,
  current_artifact_sha256: current.artifact_sha256, prior_healthy_duration_ms: healthyDurationMs,
  qualification_interference: "CONTROLLED_GATEWAY_PAUSE_FOR_SIGNED_SHADOW_DIAGNOSTIC",
  diagnostic_shadow_sha256: sha(shadowBytes), plist_backup_sha256: sha(plistBytes),
  diagnostic_shadow_started_at: shadow.started_at,
  controlled_pause_backup_mtime: new Date(backupMtime).toISOString(),
  successor_release_id: successorItem.releaseId, signed_retry_manifest: "PASS",
  successor_rollout_status: rollout.successor_status,
  live_trust: "PASS", exact_targeting: true, broad_cohort: false,
  gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  actions: ["AUTHORIZE_ONE_TIME_EXACT_0_2_46_RETRY", "OTA_AGENT_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK"],
  camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };

if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "PREFLIGHT_PASS", evidence_sha256: evidenceSha,
    release_id: RELEASE_ID, prior_healthy_duration_ms: healthyDurationMs,
    qualification_interference: plan.qualification_interference, exact_device: true,
    broad_cohort: false, camera_runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_PLAN_PIN_MISMATCH");
const approved = JSON.parse(planBytes);
const planAge = Date.now() - Date.parse(approved.generated_at || "");
if (approved.protocol !== plan.protocol || approved.mode !== "PREFLIGHT" ||
  approved.release_id !== RELEASE_ID || approved.current_release_id !== CURRENT_RELEASE_ID ||
  approved.diagnostic_shadow_sha256 !== plan.diagnostic_shadow_sha256 ||
  approved.plist_backup_sha256 !== plan.plist_backup_sha256 || !approved.exact_targeting ||
  approved.broad_cohort !== false || !Number.isFinite(planAge) || planAge < -300_000 || planAge > 15 * 60_000)
  throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RETRY_PLAN_INVALID");

const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
  expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
  failed_slot_removed: true, quarantine_removed_for_exact_release: true,
  exact_retry_rollout_active: true, successor_waiting: true,
  camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
const evidenceSha = persist(result);
console.log(JSON.stringify({ status: "EXACT_GATEWAY_ROUTINE_CONFIRMATION_RETRY_AUTHORIZED",
  evidence_sha256: evidenceSha, release_id: RELEASE_ID, successor_release_id: successorItem.releaseId,
  exact_device: true, broad_cohort: false, ota_agent_owns_install: true,
  camera_runtime_writes: 0 }));
