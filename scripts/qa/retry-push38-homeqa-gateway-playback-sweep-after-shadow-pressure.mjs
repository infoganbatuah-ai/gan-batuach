// Authorize one exact retry of signed Gateway 0.2.75 after the read-only
// successor Shadow proof coincided with three short installed-agent health
// timeouts. The installed OTA agent remains the sole downloader, installer,
// health gate, promoter, and rollback owner.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync,
  writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION as retryItem
} from "../../services/video-gateway/push38-home-qa-gateway-playback-sweep-serialization.mjs";
import { PUSH38_GATEWAY_FINITE_RESPONSE_CONTINUITY as successorItem
} from "../../services/video-gateway/push38-home-qa-gateway-finite-response-continuity.mjs";
import { PUSH38_CONNECTOR_RTSP_CADENCE as connectorItem
} from "../../services/video-gateway/push38-home-qa-connector-rtsp-cadence.mjs";

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
const shadowPath = option("shadow-evidence") ? resolve(option("shadow-evidence")) : "";
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,command="], {
    encoding: "utf8", timeout: 10_000 }).split("\n");
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
    signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  const lifecycle = body.recorderSessionLifecycle || {};
  const heartbeat = body.recorderSessionHeartbeat || {};
  return { http: response.status, pid, ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? body.lastDiscovery?.channelCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? 0,
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
function gatewayRollbackSafe(sample) {
  const allowed = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  return sample.http === 200 && sample.status === "degraded" && sample.assigned === 10 &&
    sample.connected === 9 && sample.failed === 1 && sample.empty === 6 &&
    sample.progressing === 9 && sample.stalled === 0 && sample.version === retryItem.rollbackVersion &&
    sample.active_sessions === 1 && sample.login_attempts >= 1 &&
    sample.login_succeeded === sample.login_attempts && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.reason_codes.every(reason => allowed.has(reason));
}
function connectorPrerequisiteSafe(sample) {
  // A fresh discovery probe can fail while the already-open Tapo relay keeps
  // producing current media. Preserve both facts in evidence and require the
  // stronger runtime invariant: the exact signed Connector, one progressing
  // relay, no stall, and no reason other than that bounded probe failure.
  const discovery = sample.connected === 1 && sample.failed === 0 &&
    sample.reason_codes.length === 0 || sample.connected === 0 && sample.failed === 1 &&
    JSON.stringify(sample.reason_codes) === JSON.stringify(["DISCOVERY_PROBE_FAILED"]);
  return sample.http === 200 && sample.ok && sample.status === "healthy" &&
    sample.assigned === 1 && sample.empty === 0 && sample.progressing === 1 &&
    sample.stalled === 0 && sample.version === connectorItem.version && discovery;
}

const shadowBytes = protectedFile(shadowPath);
const shadow = JSON.parse(shadowBytes);
const shadowStartedAt = Date.parse(shadow.started_at || "");
const shadowEndedAt = Date.parse(shadow.ended_at || "");
if (shadow.contract !== "observer-push38-bounded-dvr-shadow-v1" || shadow.result !== "PASS" ||
  shadow.mode !== "READ_ONLY_ONE_CHANNEL_SHADOW" || shadow.runtime_mutation !== false ||
  shadow.runtime_source !== "SIGNED_RELEASE_BUNDLE" ||
  shadow.signed_release?.release_id !== successorItem.releaseId ||
  shadow.signed_release?.artifact_sha256 !== successorItem.digest ||
  shadow.signed_release?.signature_verified !== true ||
  shadow.signed_release?.artifact_verified !== true || shadow.duration_ms < 10 * 60_000 ||
  shadow.qualification?.playback_failures !== 0 || shadow.qualification?.failures?.length !== 0 ||
  shadow.checkpoints?.length < 50 || shadow.checkpoints.some(point => point.shadow?.http !== 200 ||
    point.shadow?.media?.available !== 1 || point.shadow?.media?.stalled !== 0) ||
  !Number.isFinite(shadowStartedAt) || !Number.isFinite(shadowEndedAt) || shadowEndedAt <= shadowStartedAt)
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_SHADOW_EVIDENCE_INVALID");

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: retryItem.deviceId, profile: retryItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: retryItem.rollbackVersion,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifest = JSON.parse(readFileSync(join(root, "slots", retryItem.version, "release.json"), "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const quarantined = manager.quarantine().find(item => item.release_id === retryItem.releaseId);
const priorRetry = manager.readJson(manager.quarantineRetryPath, [])
  .find(item => item.release_id === retryItem.releaseId);
const crashIndex = state.history?.findLastIndex(item => item.state === "ROLLBACK_REQUIRED" &&
  item.category === FAILURE) ?? -1;
const healthyIndex = crashIndex < 0 ? -1 : state.history.slice(0, crashIndex)
  .findLastIndex(item => item.state === "HEALTHY");
const healthyDurationMs = crashIndex < 0 || healthyIndex < 0 ? NaN :
  Date.parse(state.history[crashIndex].at) - Date.parse(state.history[healthyIndex].at);
const rollbackAt = crashIndex < 0 ? NaN : Date.parse(state.history[crashIndex].at);
const liveBeforeRollback = shadow.checkpoints.filter(point =>
  Date.parse(point.observed_at || "") < rollbackAt && point.legacy?.http === 200);
if (!verified.ok || manifest.release_id !== retryItem.releaseId ||
  manifest.version !== retryItem.version || manifest.build_sha !== retryItem.buildSha ||
  manifest.artifact_sha256 !== retryItem.digest ||
  manifest.compatibility?.minimum_current_version !== retryItem.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== retryItem.rollbackVersion ||
  current.release_id !== retryItem.rollbackReleaseId || current.version !== retryItem.rollbackVersion ||
  !knownGood.some(item => item.release_id === current.release_id &&
    item.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== retryItem.releaseId || state.failure_category !== FAILURE ||
  quarantined?.reason !== FAILURE || priorRetry || !Number.isFinite(healthyDurationMs) ||
  healthyDurationMs < 6 * 60 * 60_000 || !Number.isFinite(rollbackAt) ||
  rollbackAt <= shadowStartedAt || rollbackAt >= shadowEndedAt || liveBeforeRollback.length < 20)
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: retryItem.version, slot: join(root, "slots", retryItem.version),
  release_id: retryItem.releaseId, artifact_sha256: retryItem.digest });

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== connectorItem.releaseId ||
  !connectorManager.knownGood().some(item => item.release_id === connectorItem.releaseId))
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'retry_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${retryItem.releaseId}'),
  'retry_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${retryItem.releaseId}'),
  'retry_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${retryItem.releaseId}'),
  'successor_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'successor_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'successor_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0));`));
const exactTargets = { explicit_device_ids: [retryItem.deviceId] };
if (rollout.retry_status !== "PAUSED" || rollout.retry_cohort !== 0 ||
  JSON.stringify(rollout.retry_targets) !== JSON.stringify(exactTargets) ||
  !["DRAFT", "PAUSED"].includes(rollout.successor_status) || rollout.successor_cohort !== 0 ||
  JSON.stringify(rollout.successor_targets) !== JSON.stringify(exactTargets) || rollout.broad_active !== 0)
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_ROLLOUT_INVALID");

if (activeHeavyDevelopmentProcesses().length)
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_HOST_BUSY");
const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 3; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map(item => item.pid)).size !== 1 ||
  gatewaySamples.some(item => !gatewayRollbackSafe(item)) ||
  new Set(connectorSamples.map(item => item.pid)).size !== 1 || connectorSamples.some(item =>
    !connectorPrerequisiteSafe(item)))
  throw new Error(`P38_GATEWAY_PLAYBACK_SWEEP_RETRY_RUNTIME_UNSAFE:${JSON.stringify({
    gatewaySamples, connectorSamples
  })}`);

const plan = { protocol: "observer-push38-gateway-playback-sweep-shadow-pressure-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: retryItem.releaseId,
  version: retryItem.version, build_sha: retryItem.buildSha, artifact_sha256: retryItem.digest,
  exact_device_id: retryItem.deviceId, previous_failure: FAILURE,
  current_release_id: retryItem.rollbackReleaseId,
  prior_healthy_duration_ms: healthyDurationMs,
  qualification_interference: "READ_ONLY_SIGNED_SUCCESSOR_SHADOW_WITH_STRICT_AGENT_HEALTH_TIMEOUTS",
  shadow_evidence_sha256: sha(shadowBytes), shadow_window: {
    started_at: shadow.started_at, rollback_at: state.history[crashIndex].at, ended_at: shadow.ended_at },
  pre_rollback_live_health_200_samples: liveBeforeRollback.length,
  successor_release_id: successorItem.releaseId, signed_retry_manifest: "PASS",
  live_trust: "PASS", exact_targeting: true, broad_cohort: false,
  gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  actions: ["AUTHORIZE_ONE_TIME_EXACT_0_2_75_RETRY", "ACTIVATE_EXACT_0_2_75_ROLLOUT",
    "OTA_AGENT_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK", "THEN_ACTIVATE_EXACT_0_2_76_SUCCESSOR"],
  camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_PLAYBACK_SWEEP_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: retryItem.releaseId,
    prior_healthy_duration_ms: healthyDurationMs,
    pre_rollback_live_health_200_samples: liveBeforeRollback.length,
    exact_device: true, broad_cohort: false, camera_runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
const planAge = Date.now() - Date.parse(saved.generated_at || "");
if (saved.protocol !== plan.protocol || saved.release_id !== retryItem.releaseId ||
  saved.current_release_id !== retryItem.rollbackReleaseId ||
  saved.shadow_evidence_sha256 !== plan.shadow_evidence_sha256 || !saved.exact_targeting ||
  saved.broad_cohort !== false || !Number.isFinite(planAge) || planAge < -300_000 ||
  planAge > 10 * 60_000)
  throw new Error("P38_GATEWAY_PLAYBACK_SWEEP_RETRY_PLAN_INVALID");

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
    where release_id=(select id from public.observer_edge_releases where release_id='${retryItem.releaseId}')
      and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${retryItem.deviceId}');
    do $$ begin
      if not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
        where r.release_id='${retryItem.releaseId}' and o.status='ACTIVE' and o.cohort_percent=0
        and o.target_filters->'explicit_device_ids'=jsonb_build_array('${retryItem.deviceId}')) or
        exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0)
      then raise exception 'P38_GATEWAY_PLAYBACK_SWEEP_RETRY_ACTIVATION_FAILED'; end if;
    end $$;
  commit;`;
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(root, "slots", retryItem.version)),
    exact_retry_rollout_active: true, successor_waiting: true,
    camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_PLAYBACK_SWEEP_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: retryItem.releaseId,
    successor_release_id: successorItem.releaseId, exact_device: true,
    broad_cohort: false, ota_agent_owns_install: true, camera_runtime_writes: 0 }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
