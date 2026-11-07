// Authorize at most one exact retry of signed Gateway 0.2.79 after the failed
// live health gate was correlated with host-wide qualification interference.
// The normal installed OTA agent remains the sole downloader, installer,
// health gate, promoter, quarantine, and rollback owner.
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
import { PUSH38_GATEWAY_EVENT_LOOP_CLEANUP as item
} from "../../services/video-gateway/push38-home-qa-gateway-event-loop-cleanup.mjs";
import { PUSH38_CONNECTOR_DEVICE_IDENTITY_CONTINUITY as connectorItem
} from "../../services/video-gateway/push38-home-qa-connector-device-identity-continuity.mjs";

const FAILURE = "EDGE_UPDATE_HEALTH_PROCESS_RUNNING_FAILED";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
const stabilityPath = option("stability-evidence") ? resolve(option("stability-evidence")) : "";
const priorApplyPath = option("prior-apply-evidence") ? resolve(option("prior-apply-evidence")) : "";
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_MODE_OR_OUTPUT_INVALID");

const sha = (value) => createHash("sha256").update(value).digest("hex");
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
  return classes.flatMap(([kind, pattern]) => rows.some((row) => pattern.test(row)) ? [kind] : []);
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
    reason_codes: body.health_reason_codes || [], rotations: lifecycle.rotations ?? 0,
    active_sessions: lifecycle.active_sessions ?? 1,
    login_attempts: lifecycle.login_attempts ?? 1,
    login_succeeded: lifecycle.login_succeeded ?? 1,
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
    sample.progressing === 9 && sample.stalled === 0 && sample.version === item.rollbackVersion &&
    sample.active_sessions === 1 && sample.login_attempts >= 1 &&
    sample.login_succeeded === sample.login_attempts && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.reason_codes.every((reason) => allowed.has(reason));
}
function connectorSafe(sample) {
  const discovery = sample.connected === 1 && sample.failed === 0 && sample.reason_codes.length === 0 ||
    sample.connected === 0 && sample.failed === 1 &&
      JSON.stringify(sample.reason_codes) === JSON.stringify(["DISCOVERY_PROBE_FAILED"]);
  return sample.http === 200 && sample.ok && sample.status === "healthy" &&
    sample.assigned === 1 && sample.empty === 0 && sample.progressing === 1 &&
    sample.stalled === 0 && sample.version === connectorItem.version && discovery;
}

const stabilityBytes = protectedFile(stabilityPath);
const stability = JSON.parse(stabilityBytes);
const stabilityStarted = Date.parse(stability.started_at || "");
const stabilityEnded = Date.parse(stability.ended_at || "");
if (stability.protocol !== "observer-push38-live-gateway-dvr-truth-v1" ||
  stability.result !== "MEDIA_AND_SOURCE_TRUTH_PASS" ||
  stability.expected_physical !== 10 ||
  JSON.stringify(stability.source_available) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 10, 11]) ||
  JSON.stringify(stability.upstream_unavailable) !== JSON.stringify([8]) ||
  JSON.stringify(stability.empty) !== JSON.stringify([9, 12, 13, 14, 15, 16]) ||
  stability.duration_ms < 10 * 60_000 || stability.checkpoints?.length < 9 ||
  stability.summary?.every_available_source_decoded_at_every_checkpoint !== true ||
  stability.summary?.every_available_source_progressing_at_every_checkpoint !== true ||
  stability.summary?.all_discovery_truthful !== true ||
  stability.summary?.upstream_unavailable_never_authorized !== true ||
  !Number.isFinite(stabilityStarted) || !Number.isFinite(stabilityEnded) || stabilityEnded <= stabilityStarted)
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_STABILITY_EVIDENCE_INVALID");

const priorApplyBytes = protectedFile(priorApplyPath);
const priorApply = JSON.parse(priorApplyBytes);
if (priorApply.protocol !== "observer-push38-gateway-event-loop-cleanup-activation-v1" ||
  priorApply.mode !== "APPLY" || priorApply.release_id !== item.releaseId ||
  priorApply.artifact_sha256 !== item.digest || priorApply.current_release_id !== item.rollbackReleaseId ||
  priorApply.ota_agent_owns_install !== true || priorApply.exact_rollout_active !== true ||
  priorApply.broad_cohort !== false)
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_PRIOR_APPLY_INVALID");

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: item.rollbackVersion,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifest = JSON.parse(readFileSync(join(root, "slots", item.version, "release.json"), "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const quarantined = manager.quarantine().find((entry) => entry.release_id === item.releaseId);
const priorRetries = manager.readJson(manager.quarantineRetryPath, [])
  .filter((entry) => entry.release_id === item.releaseId);
const originalFailure = state.failure_category === FAILURE || state.history?.some((entry) =>
  ["ROLLBACK_REQUIRED", "ROLLING_BACK"].includes(entry.state) && entry.category === FAILURE);
if (!verified.ok || manifest.release_id !== item.releaseId || manifest.version !== item.version ||
  manifest.build_sha !== item.buildSha || manifest.artifact_sha256 !== item.digest ||
  manifest.compatibility?.minimum_current_version !== item.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== item.rollbackVersion ||
  current.release_id !== item.rollbackReleaseId || current.version !== item.rollbackVersion ||
  !knownGood.some((entry) => entry.release_id === current.release_id &&
    entry.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== item.releaseId || !originalFailure || quarantined?.reason !== FAILURE ||
  priorRetries.length !== 0)
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: item.version, slot: join(root, "slots", item.version),
  release_id: item.releaseId, artifact_sha256: item.digest });

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== connectorItem.releaseId ||
  !connectorManager.knownGood().some((entry) => entry.release_id === connectorItem.releaseId))
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0));`));
const exactTargets = { explicit_device_ids: [item.deviceId] };
if (rollout.status !== "PAUSED" || rollout.cohort !== 0 ||
  JSON.stringify(rollout.targets) !== JSON.stringify(exactTargets) || rollout.broad_active !== 0)
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_ROLLOUT_INVALID");
const busy = activeHeavyDevelopmentProcesses();
if (busy.length) throw new Error(`P38_GATEWAY_EVENT_LOOP_RETRY_HOST_BUSY:${busy.join(",")}`);

const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 5; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 4) await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map((entry) => entry.pid)).size !== 1 ||
  gatewaySamples.some((entry) => !gatewayRollbackSafe(entry)) ||
  new Set(connectorSamples.map((entry) => entry.pid)).size !== 1 ||
  connectorSamples.some((entry) => !connectorSafe(entry)))
  throw new Error(`P38_GATEWAY_EVENT_LOOP_RETRY_RUNTIME_UNSAFE:${JSON.stringify({
    gatewaySamples, connectorSamples
  })}`);

const plan = { protocol: "observer-push38-gateway-event-loop-host-isolation-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: item.releaseId,
  version: item.version, build_sha: item.buildSha, artifact_sha256: item.digest,
  exact_device_id: item.deviceId, previous_failure: FAILURE,
  current_release_id: item.rollbackReleaseId, authorization_attempt: 1,
  qualification_interference: "HOST_WIDE_PRESSURE_REMOVED_AND_NINE_SOURCE_MEDIA_REPROVED",
  stability_evidence_sha256: sha(stabilityBytes),
  prior_apply_evidence_sha256: sha(priorApplyBytes),
  signed_retry_manifest: "PASS", live_trust: "PASS", exact_targeting: true,
  broad_cohort: false, gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  actions: ["AUTHORIZE_ONE_TIME_EXACT_0_2_79_RETRY", "ACTIVATE_EXACT_0_2_79_ROLLOUT",
    "OTA_AGENT_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK"],
  camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_EVENT_LOOP_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
    broad_cohort: false, camera_runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
const planAge = Date.now() - Date.parse(saved.generated_at || "");
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.current_release_id !== item.rollbackReleaseId ||
  saved.stability_evidence_sha256 !== plan.stability_evidence_sha256 ||
  saved.prior_apply_evidence_sha256 !== plan.prior_apply_evidence_sha256 ||
  saved.exact_targeting !== true || saved.broad_cohort !== false ||
  !Number.isFinite(planAge) || planAge < -300_000 || planAge > 10 * 60_000)
  throw new Error("P38_GATEWAY_EVENT_LOOP_RETRY_PLAN_INVALID");

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
    where release_id=(select id from public.observer_edge_releases where release_id='${item.releaseId}')
      and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}');
    do $$ begin
      if not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
        where r.release_id='${item.releaseId}' and o.status='ACTIVE' and o.cohort_percent=0
        and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')) or
        exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0)
      then raise exception 'P38_GATEWAY_EVENT_LOOP_RETRY_ACTIVATION_FAILED'; end if;
    end $$;
  commit;`;
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(root, "slots", item.version)),
    exact_retry_rollout_active: true, camera_runtime_writes_by_command: 0,
    ota_agent_owns_install: true };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_EVENT_LOOP_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
    broad_cohort: false, ota_agent_owns_install: true, camera_runtime_writes: 0 }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
