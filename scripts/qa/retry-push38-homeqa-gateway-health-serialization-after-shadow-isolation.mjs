// Authorize one exact retry of signed Gateway 0.2.64 after the controlled
// qualification pause was carried into the crash-loop observation window.
// The installed OTA agent remains the only downloader, installer, health
// gate, promoter, and rollback owner.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync,
  statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_GATEWAY_ROUTINE_CONFIRMATION as successor
} from "../../services/video-gateway/push38-home-qa-gateway-routine-confirmation.mjs";
import { PUSH38_CONNECTOR_RTSP_CADENCE as connector
} from "../../services/video-gateway/push38-home-qa-connector-rtsp-cadence.mjs";

const DEVICE_ID = successor.deviceId;
const RELEASE_ID = successor.rollbackReleaseId;
const VERSION = successor.rollbackVersion;
const DIGEST = "dee178ab7c455b7e744d3a1658e79333296f5420787299182b021f9020068ba2";
const BUILD_SHA = "5b3ee9f0e78c22926ff5688ee9f77c973257632b";
const CURRENT_RELEASE_ID = successor.failedHealthSerializationPredecessorReleaseId;
const CURRENT_VERSION = successor.failedHealthSerializationPredecessorVersion;
const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
const isolationPath = option("isolation-evidence") ? resolve(option("isolation-evidence")) : "";
const shadowPath = option("shadow-evidence") ? resolve(option("shadow-evidence")) : "";
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function docker(args, input) {
  return execFileSync("docker", ["--context", "colima-push38t", ...args], {
    encoding: "utf8", timeout: 45_000, input,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]
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
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  const lifecycle = body.recorderSessionLifecycle || {};
  const heartbeat = body.recorderSessionHeartbeat || {};
  return { http: response.status, pid, ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    reason_codes: body.health_reason_codes || [],
    rotations: lifecycle.rotations ?? 0, active_sessions: lifecycle.active_sessions ?? 1,
    login_attempts: lifecycle.login_attempts ?? 1, login_succeeded: lifecycle.login_succeeded ?? 1,
    responses_ok: heartbeat.responses_ok ?? 0,
    consecutive_failures: heartbeat.consecutive_failures ?? 0,
    authentication_rejected: heartbeat.authentication_rejected ?? 0,
    version: body.edgeRuntime?.software_version || null,
    build_sha: body.edgeRuntime?.build_sha || null };
}
function gatewaySafe(sample) {
  const allowed = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  return sample.http === 200 && ["degraded", "healthy"].includes(sample.status) &&
    sample.assigned === 10 && sample.connected === 9 && sample.failed === 1 && sample.empty === 6 &&
    sample.progressing === 9 && sample.stalled === 0 && sample.version === CURRENT_VERSION &&
    sample.active_sessions === 1 && sample.login_attempts >= 1 &&
    sample.login_succeeded === sample.login_attempts && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.reason_codes.every(reason => allowed.has(reason));
}

const isolationBytes = protectedFile(isolationPath);
const shadowBytes = protectedFile(shadowPath);
const isolation = JSON.parse(isolationBytes);
const shadow = JSON.parse(shadowBytes);
const isolationStart = Date.parse(isolation.started_at || "");
const isolationEnd = Date.parse(isolation.ended_at || "");
if (isolation.protocol !== "observer-push38-isolated-dvr-shadow-v1" || isolation.result !== "PASS" ||
  isolation.method !== "CONTROLLED_LAUNCHD_PAUSE_WITH_FINALLY_RESTORE" ||
  isolation.live_gateway_temporarily_unavailable !== true || isolation.ota_agent_paused_during_test !== true ||
  isolation.exact_live_release_restored !== true || isolation.baseline_before?.version !== VERSION ||
  isolation.baseline_after?.version !== VERSION || isolation.shadow_result !== "PASS" ||
  isolation.shadow_evidence_sha256 !== sha(shadowBytes) || !Number.isFinite(isolationStart) ||
  !Number.isFinite(isolationEnd) || isolationEnd <= isolationStart ||
  shadow.contract !== "observer-push38-bounded-dvr-shadow-v1" || shadow.result !== "PASS" ||
  shadow.runtime_mutation !== false || shadow.runtime_source !== "SIGNED_RELEASE_BUNDLE" ||
  shadow.signed_release?.release_id !== successor.releaseId ||
  shadow.signed_release?.signature_verified !== true || shadow.signed_release?.artifact_verified !== true ||
  shadow.final_verification?.terminal_verification !== true)
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_ISOLATION_EVIDENCE_INVALID");

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: DEVICE_ID, profile: "PHYSICAL_GATEWAY", platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: CURRENT_VERSION,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifest = JSON.parse(readFileSync(join(root, "slots", VERSION, "release.json"), "utf8"));
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const quarantined = manager.quarantine().find(item => item.release_id === RELEASE_ID);
const quarantineAt = Date.parse(quarantined?.at || "");
const retryAlreadyExists = manager.readJson(manager.quarantineRetryPath, [])
  .some(item => item.release_id === RELEASE_ID);
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const rollbackIndex = state.history?.findLastIndex(item => item.state === "ROLLBACK_REQUIRED" &&
  item.category === FAILURE) ?? -1;
const healthyIndex = rollbackIndex < 0 ? -1 : state.history.slice(0, rollbackIndex)
  .findLastIndex(item => item.state === "HEALTHY");
const priorHealthyMs = rollbackIndex < 0 || healthyIndex < 0 ? NaN :
  Date.parse(state.history[rollbackIndex].at) - Date.parse(state.history[healthyIndex].at);
if (!verified.ok || manifest.release_id !== RELEASE_ID || manifest.version !== VERSION ||
  manifest.build_sha !== BUILD_SHA || manifest.artifact_sha256 !== DIGEST ||
  manifest.compatibility?.minimum_current_version !== CURRENT_VERSION ||
  manifest.compatibility?.maximum_current_version !== CURRENT_VERSION ||
  current.release_id !== CURRENT_RELEASE_ID || current.version !== CURRENT_VERSION ||
  !knownGood.some(item => item.release_id === CURRENT_RELEASE_ID &&
    item.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== RELEASE_ID || state.failure_category !== FAILURE ||
  quarantined?.reason !== FAILURE || retryAlreadyExists || !Number.isFinite(quarantineAt) ||
  quarantineAt < isolationStart || quarantineAt - isolationEnd > 15 * 60_000 ||
  !Number.isFinite(priorHealthyMs) || priorHealthyMs < 60 * 60_000)
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: VERSION, slot: join(root, "slots", VERSION),
  release_id: RELEASE_ID, artifact_sha256: DIGEST });

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connector.deviceId, profile: connector.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connector.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== connector.releaseId ||
  !connectorManager.knownGood().some(item => item.release_id === connector.releaseId))
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'retry_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'),
  'retry_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'),
  'retry_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${RELEASE_ID}'),
  'successor_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successor.releaseId}'),
  'successor_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successor.releaseId}'),
  'successor_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successor.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0));`));
const exactTargets = { explicit_device_ids: [DEVICE_ID] };
if (rollout.retry_status !== "PAUSED" || rollout.retry_cohort !== 0 ||
  JSON.stringify(rollout.retry_targets) !== JSON.stringify(exactTargets) ||
  !["DRAFT", "PAUSED"].includes(rollout.successor_status) || rollout.successor_cohort !== 0 ||
  JSON.stringify(rollout.successor_targets) !== JSON.stringify(exactTargets) || rollout.broad_active !== 0)
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_ROLLOUT_INVALID");

if (activeHeavyDevelopmentProcesses().length)
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_HOST_BUSY");
const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 3; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map(item => item.pid)).size !== 1 || gatewaySamples.some(item => !gatewaySafe(item)) ||
  new Set(connectorSamples.map(item => item.pid)).size !== 1 || connectorSamples.some(item =>
    item.http !== 200 || !item.ok || item.status !== "healthy" || item.assigned !== 1 ||
    item.connected !== 1 || item.progressing !== 1 || item.stalled !== 0 || item.version !== connector.version))
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_RUNTIME_UNSAFE");

const plan = { protocol: "observer-push38-gateway-health-serialization-shadow-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: RELEASE_ID,
  version: VERSION, build_sha: BUILD_SHA, artifact_sha256: DIGEST, exact_device_id: DEVICE_ID,
  previous_failure: FAILURE, current_release_id: CURRENT_RELEASE_ID,
  prior_healthy_duration_ms: priorHealthyMs,
  qualification_interference: "CONTROLLED_GATEWAY_AND_OTA_PAUSE_FOR_SIGNED_SHADOW",
  isolation_evidence_sha256: sha(isolationBytes), shadow_evidence_sha256: sha(shadowBytes),
  isolation_window: { started_at: isolation.started_at, ended_at: isolation.ended_at },
  successor_release_id: successor.releaseId, signed_retry_manifest: "PASS", live_trust: "PASS",
  exact_targeting: true, broad_cohort: false,
  gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  actions: ["AUTHORIZE_ONE_TIME_EXACT_0_2_64_RETRY", "ACTIVATE_EXACT_0_2_64_ROLLOUT",
    "OTA_AGENT_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK"],
  camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_HEALTH_SERIALIZATION_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: RELEASE_ID, exact_device: true,
    broad_cohort: false, camera_runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
const planAge = Date.now() - Date.parse(saved.generated_at || "");
if (saved.protocol !== plan.protocol || saved.release_id !== RELEASE_ID ||
  saved.current_release_id !== CURRENT_RELEASE_ID ||
  saved.isolation_evidence_sha256 !== plan.isolation_evidence_sha256 ||
  saved.shadow_evidence_sha256 !== plan.shadow_evidence_sha256 || !saved.exact_targeting ||
  saved.broad_cohort !== false || !Number.isFinite(planAge) || planAge < -300_000 || planAge > 10 * 60_000)
  throw new Error("P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_PLAN_INVALID");

let authorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
  authorized = true;
  const sql = `begin;
    update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
    where release_id in (select id from public.observer_edge_releases where channel='HOME_QA' and deployment_profile='PHYSICAL_GATEWAY')
      and status in ('DRAFT','ACTIVE');
    update public.observer_edge_rollouts set status='ACTIVE',paused_reason=null,updated_at=now()
    where release_id=(select id from public.observer_edge_releases where release_id='${RELEASE_ID}')
      and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${DEVICE_ID}');
    do $$ begin
      if not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
        where r.release_id='${RELEASE_ID}' and o.status='ACTIVE' and o.cohort_percent=0
        and o.target_filters->'explicit_device_ids'=jsonb_build_array('${DEVICE_ID}')) or
        exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0)
      then raise exception 'P38_GATEWAY_HEALTH_SERIALIZATION_RETRY_ACTIVATION_FAILED'; end if;
    end $$;
  commit;`;
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(root, "slots", VERSION)), exact_retry_rollout_active: true,
    successor_waiting: true, camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_HEALTH_SERIALIZATION_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: RELEASE_ID,
    successor_release_id: successor.releaseId, exact_device: true, broad_cohort: false,
    ota_agent_owns_install: true, camera_runtime_writes: 0 }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
