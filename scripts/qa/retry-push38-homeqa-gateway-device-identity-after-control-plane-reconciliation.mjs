// Authorize one exact retry of signed Gateway 0.2.77 after the isolated
// HOME_QA enrollment/config/consent defects were reconciled and the heavy CUA
// process was removed. The installed OTA agent remains the only downloader,
// installer, health gate, promoter and rollback owner.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync,
  statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir, loadavg } from "node:os";
import { join, resolve, sep } from "node:path";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_GATEWAY_DEVICE_IDENTITY_CONTINUITY as item
} from "../../services/video-gateway/push38-home-qa-gateway-device-identity-continuity.mjs";
import { PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION as rollbackItem
} from "../../services/video-gateway/push38-home-qa-gateway-playback-sweep-serialization.mjs";
import { PUSH38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY as connectorItem
} from "../../services/video-gateway/push38-home-qa-connector-device-identity-continuity.mjs";

const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const gatewayRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
function processSnapshot() {
  return execFileSync("/bin/ps", ["-axo", "pid=,%cpu=,rss=,command="],
    { encoding: "utf8", timeout: 10_000 }).split("\n").flatMap(row => {
    const match = /^\s*(\d+)\s+([0-9.]+)\s+(\d+)\s+(.+)$/.exec(row);
    return match ? [{ pid: Number(match[1]), cpu: Number(match[2]), rss_kib: Number(match[3]),
      command: match[4] }] : [];
  });
}
function hostSafety() {
  const rows = processSnapshot();
  const heavyDevelopment = rows.filter(({ command }) =>
    /(?:^|\s)(?:tsc\s+--noEmit|next\s+build|npm\s+run\s+(?:build|lint(?::ci)?)|horizontal-(?:worker|ai)|scale-benchmark)(?:\s|$)/.test(command));
  const cua = rows.filter(({ command }) =>
    command.startsWith("/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"));
  const logicalCpu = Number(execFileSync("/usr/sbin/sysctl", ["-n", "hw.logicalcpu"],
    { encoding: "utf8", timeout: 5_000 }).trim());
  const oneMinuteLoad = loadavg()[0];
  const unsafeCua = cua.filter(item => item.cpu > 50 || item.rss_kib > 1024 * 1024);
  if (heavyDevelopment.length || unsafeCua.length || !Number.isInteger(logicalCpu) || logicalCpu < 1 ||
    !Number.isFinite(oneMinuteLoad) || oneMinuteLoad > logicalCpu * 1.5)
    throw new Error(`P38_GATEWAY_DEVICE_IDENTITY_RETRY_HOST_BUSY:${JSON.stringify({
      logical_cpu: logicalCpu, one_minute_load: oneMinuteLoad,
      heavy_development_pids: heavyDevelopment.map(item => item.pid),
      unsafe_cua_pids: unsafeCua.map(item => item.pid)
    })}`);
  return { logical_cpu: logicalCpu, one_minute_load: oneMinuteLoad,
    heavy_development_pids: [], unsafe_cua_pids: [],
    threshold_basis: "load_1m_lte_1_5x_logical_cpu_and_no_heavy_development_or_cua" };
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
    device_authorization: body.deviceAuthorization?.status || null,
    rotations: lifecycle.rotations ?? 0, active_sessions: lifecycle.active_sessions ?? 1,
    login_attempts: lifecycle.login_attempts ?? 1, login_succeeded: lifecycle.login_succeeded ?? 1,
    responses_ok: heartbeat.responses_ok ?? 0,
    consecutive_failures: heartbeat.consecutive_failures ?? 0,
    authentication_rejected: heartbeat.authentication_rejected ?? 0,
    event_loop_p99_ms: body.eventLoop?.delay_p99_ms ?? null,
    version: body.edgeRuntime?.software_version || null,
    build_sha: body.edgeRuntime?.build_sha || null };
}
function gatewayRollbackSafe(sample) {
  const allowed = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  return sample.http === 200 && sample.status === "degraded" && sample.ok === false &&
    sample.assigned === 10 && sample.connected === 9 && sample.failed === 1 && sample.empty === 6 &&
    sample.progressing === 9 && sample.stalled === 0 && sample.version === rollbackItem.version &&
    sample.build_sha === rollbackItem.buildSha && sample.device_authorization === "approval_required" &&
    sample.active_sessions === 1 && sample.login_attempts >= 1 &&
    sample.login_succeeded === sample.login_attempts && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    Number.isFinite(sample.event_loop_p99_ms) && sample.event_loop_p99_ms <= 500 &&
    sample.reason_codes.length > 0 && sample.reason_codes.every(reason => allowed.has(reason));
}
function connectorSafe(sample) {
  return sample.http === 200 && sample.ok && sample.status === "healthy" &&
    sample.assigned === 1 && sample.connected === 1 && sample.failed === 0 && sample.empty === 0 &&
    sample.progressing === 1 && sample.stalled === 0 && sample.reason_codes.length === 0 &&
    sample.device_authorization === "ready" && sample.version === connectorItem.version &&
    sample.build_sha === connectorItem.buildSha && Number.isFinite(sample.event_loop_p99_ms) &&
    sample.event_loop_p99_ms <= 500;
}

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root: gatewayRoot, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: rollbackItem.version,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifest = JSON.parse(readFileSync(join(gatewayRoot, "slots", item.version, "release.json"), "utf8"));
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const quarantined = manager.quarantine().find(record => record.release_id === item.releaseId);
const priorRetries = manager.readJson(manager.quarantineRetryPath, [])
  .filter(record => record.release_id === item.releaseId);
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const rollbackIndex = state.history?.findLastIndex(record => record.state === "ROLLBACK_REQUIRED" &&
  record.category === FAILURE) ?? -1;
const healthyIndex = rollbackIndex < 0 ? -1 : state.history.slice(0, rollbackIndex)
  .findLastIndex(record => record.state === "HEALTHY");
const priorHealthyMs = rollbackIndex < 0 || healthyIndex < 0 ? NaN :
  Date.parse(state.history[rollbackIndex].at) - Date.parse(state.history[healthyIndex].at);
if (!verified.ok || manifest.release_id !== item.releaseId || manifest.version !== item.version ||
  manifest.build_sha !== item.buildSha || manifest.artifact_sha256 !== item.digest ||
  manifest.artifact_size !== item.size ||
  manifest.compatibility?.minimum_current_version !== rollbackItem.version ||
  manifest.compatibility?.maximum_current_version !== rollbackItem.version ||
  current.release_id !== rollbackItem.releaseId || current.version !== rollbackItem.version ||
  !knownGood.some(record => record.release_id === rollbackItem.releaseId &&
    record.artifact_sha256 === rollbackItem.digest) || state.state !== "ROLLED_BACK" ||
  state.release_id !== item.releaseId || state.failure_category !== FAILURE ||
  quarantined?.reason !== FAILURE || priorRetries.length !== 0 ||
  !Number.isFinite(priorHealthyMs) || priorHealthyMs < 60 * 60_000)
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: item.version, slot: join(gatewayRoot, "slots", item.version),
  release_id: item.releaseId, artifact_sha256: item.digest });

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const connectorCurrent = connectorManager.current();
if (connectorCurrent.release_id !== connectorItem.releaseId ||
  !connectorManager.knownGood().some(record => record.release_id === connectorItem.releaseId &&
    record.artifact_sha256 === connectorItem.digest))
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorCurrent);

const qualification = JSON.parse(psql(`select jsonb_build_object(
  'rollout',(select jsonb_build_object('status',o.status,'cohort',o.cohort_percent,'targets',o.target_filters)
    from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
    where r.release_id='${item.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0),
  'gateway',(select jsonb_build_object('phase',metadata->>'home_qa_phase','profile',deployment_profile,
    'status',status,'lifecycle',lifecycle_state,'scheme',identity_scheme,'last_seen',last_seen_at,
    'active_runtime',active_runtime_instance_id is not null) from public.video_gateway_device_enrollments
    where gateway_id='${item.deviceId}'),
  'connector',(select jsonb_build_object('phase',metadata->>'home_qa_phase','profile',deployment_profile,
    'status',status,'lifecycle',lifecycle_state,'scheme',identity_scheme,'last_seen',last_seen_at,
    'active_runtime',active_runtime_instance_id is not null,'device_type',metadata->>'device_type',
    'installation_id_present',(metadata->>'installation_id') is not null,
    'config_version',metadata->>'connector_config_version') from public.video_gateway_device_enrollments
    where gateway_id='${connectorItem.deviceId}'),
  'consent',(select jsonb_build_object('monitoring_enabled',monitoring_enabled,
    'consent',metadata->>'observer_monitoring_consent','source',metadata->>'home_qa_consent_source')
    from public.observer_sites where id='${SITE_ID}'));`));
const exactTargets = { explicit_device_ids: [item.deviceId] };
const enrollmentSafe = (record, profile) => record?.phase === "MANAGED_IDENTITY_VERIFIED" &&
  record.profile === profile && record.status === "delivered" && record.lifecycle === "ACTIVE" &&
  record.scheme === "ED25519_V1" && record.active_runtime === true &&
  Date.now() - Date.parse(record.last_seen || "") < 3 * 60_000;
if (qualification.rollout?.status !== "ACTIVE" || qualification.rollout.cohort !== 0 ||
  JSON.stringify(qualification.rollout.targets) !== JSON.stringify(exactTargets) ||
  qualification.broad_active !== 0 || !enrollmentSafe(qualification.gateway, item.profile) ||
  !enrollmentSafe(qualification.connector, connectorItem.profile) ||
  qualification.connector.device_type !== connectorItem.profile ||
  qualification.connector.installation_id_present !== true ||
  qualification.connector.config_version !== "4" ||
  qualification.consent?.monitoring_enabled !== true || qualification.consent.consent !== "true" ||
  qualification.consent.source !== "PRODUCT_OWNER_CONSENT_READ_ONLY")
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_HOME_QA_INVALID");

const host = hostSafety();
const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 3; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map(sample => sample.pid)).size !== 1 ||
  gatewaySamples.some(sample => !gatewayRollbackSafe(sample)) ||
  new Set(connectorSamples.map(sample => sample.pid)).size !== 1 ||
  connectorSamples.some(sample => !connectorSafe(sample)))
  throw new Error(`P38_GATEWAY_DEVICE_IDENTITY_RETRY_RUNTIME_UNSAFE:${JSON.stringify({
    gatewaySamples, connectorSamples
  })}`);
const disk = statfsSync(gatewayRoot);
if (Number(disk.bavail) * Number(disk.bsize) < item.size * 3)
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_DISK_INSUFFICIENT");

const plan = { protocol: "observer-push38-gateway-device-identity-control-plane-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: item.releaseId,
  version: item.version, build_sha: item.buildSha, artifact_sha256: item.digest,
  artifact_size: item.size, exact_device_id: item.deviceId, previous_failure: FAILURE,
  current_release_id: rollbackItem.releaseId, prior_healthy_duration_ms: priorHealthyMs,
  remediation: {
    connector_home_qa_runtime_metadata: "RECONCILED",
    connector_config_version: 4,
    monitoring_consent: "RECONCILED_FROM_PRODUCT_READ_ONLY",
    connector_device_authorization: "ready",
    heavy_cua_process: "REMOVED"
  },
  failure_causality: "NARROWED_NOT_PROVEN_RETRY_BOUNDED_BY_EXACT_STATE_AND_ROLLBACK",
  signed_retry_manifest: "PASS", live_trust: "PASS", exact_targeting: true,
  broad_cohort: false, home_qa: qualification, host_safety: host,
  gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  actions: ["AUTHORIZE_ONE_TIME_EXACT_0_2_77_RETRY", "REACTIVATE_EXACT_0_2_77_ROLLOUT",
    "OTA_AGENT_DOWNLOAD_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK"],
  runtime_writes_by_command: 0, ota_agent_owns_install: true, new_cost: false };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_DEVICE_IDENTITY_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: item.releaseId,
    prior_healthy_duration_ms: priorHealthyMs, exact_device: true, broad_cohort: false,
    runtime_writes: 0, new_cost: false }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
const planAge = Date.now() - Date.parse(saved.generated_at || "");
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.artifact_sha256 !== item.digest || saved.current_release_id !== rollbackItem.releaseId ||
  saved.exact_device_id !== item.deviceId || saved.exact_targeting !== true ||
  saved.broad_cohort !== false || saved.remediation?.connector_device_authorization !== "ready" ||
  !Number.isFinite(planAge) || planAge < -300_000 || planAge > 10 * 60_000)
  throw new Error("P38_GATEWAY_DEVICE_IDENTITY_RETRY_PLAN_INVALID");

let authorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
  authorized = true;
  const sql = `begin;
    update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
    where release_id in (select id from public.observer_edge_releases
      where channel='HOME_QA' and deployment_profile='PHYSICAL_GATEWAY')
      and status in ('DRAFT','ACTIVE');
    update public.observer_edge_rollouts set status='ACTIVE',paused_reason=null,updated_at=now()
    where release_id=(select id from public.observer_edge_releases where release_id='${item.releaseId}')
      and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}');
    do $$ begin
      if not exists(select 1 from public.observer_edge_rollouts o
        join public.observer_edge_releases r on r.id=o.release_id
        where r.release_id='${item.releaseId}' and o.status='ACTIVE' and o.cohort_percent=0
        and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')) or
        exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0)
      then raise exception 'P38_GATEWAY_DEVICE_IDENTITY_RETRY_ACTIVATION_FAILED'; end if;
    end $$;
  commit;`;
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(gatewayRoot, "slots", item.version)),
    exact_retry_rollout_active: true, runtime_writes_by_command: 0,
    ota_agent_owns_install: true, new_cost: false };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_DEVICE_IDENTITY_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
    broad_cohort: false, ota_agent_owns_install: true, runtime_writes: 0, new_cost: false }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
