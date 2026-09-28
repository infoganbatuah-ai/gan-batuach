// Authorize one exact, short-lived retry of signed Gateway 0.2.19 after its
// automatic rollback, solely to satisfy the signed 0.2.20 successor's exact
// compatibility boundary. The installed OTA agent remains the only installer,
// health gate, promoter and rollback owner.
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
import { PUSH38_CONNECTOR_LIVENESS_CONTINUITY as connectorItem
} from "../../services/video-gateway/push38-home-qa-connector-liveness-continuity.mjs";
import { PUSH38_GATEWAY_HEARTBEAT_LOGIN as successorItem
} from "../../services/video-gateway/push38-home-qa-gateway-heartbeat-login.mjs";
import { PUSH38_GATEWAY_SESSION_SWEEP as bridgeItem
} from "../../services/video-gateway/push38-home-qa-gateway-session-sweep.mjs";

const failure = "EDGE_UPDATE_CRASH_LOOP";
const rollbackReleaseId = "qa-p38-health-gateway-maintenance-isolation-995d6f822468";
const rollbackVersion = "0.2.17-p38-health";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
const successorBundlePath = option("successor-bundle") ? resolve(option("successor-bundle")) : "";
const failedPreSoakPath = option("failed-pre-soak-evidence")
  ? resolve(option("failed-pre-soak-evidence")) : "";
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_PROTECTED_EVIDENCE_REQUIRED");
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
  const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${label}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return text.includes("state = running") ? Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null : null;
}
async function healthSample(port, label) {
  const pid = servicePid(label);
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  return { http: response.status, pid, ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    version: body.edgeRuntime?.software_version || null,
    build_sha: body.edgeRuntime?.build_sha || null };
}

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: bridgeItem.deviceId, profile: bridgeItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: rollbackVersion,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const bridgeManifest = JSON.parse(readFileSync(join(root, "slots", bridgeItem.version, "release.json"), "utf8"));
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const bridgeVerified = verifyEdgeUpdateManifest(bridgeManifest, trusted);
const originalFailure = state.history?.some(item => item.state === "ROLLBACK_REQUIRED" && item.category === failure);
if (!bridgeVerified.ok || bridgeManifest.release_id !== bridgeItem.releaseId ||
  bridgeManifest.artifact_sha256 !== bridgeItem.digest || current.release_id !== rollbackReleaseId ||
  current.version !== rollbackVersion || !knownGood.some(item => item.release_id === rollbackReleaseId &&
    item.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== bridgeItem.releaseId || !originalFailure ||
  !manager.quarantine().some(item => item.release_id === bridgeItem.releaseId && item.reason === failure) ||
  manager.readJson(manager.quarantineRetryPath, []).some(item => item.release_id === bridgeItem.releaseId))
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: bridgeItem.version, slot: join(root, "slots", bridgeItem.version),
  release_id: bridgeItem.releaseId, artifact_sha256: bridgeItem.digest });

const crashIndex = state.history.findLastIndex(item => item.state === "ROLLBACK_REQUIRED" && item.category === failure);
const healthyIndex = state.history.slice(0, crashIndex).findLastIndex(item => item.state === "HEALTHY");
const healthyDurationMs = Date.parse(state.history[crashIndex]?.at || "") -
  Date.parse(state.history[healthyIndex]?.at || "");
if (crashIndex < 0 || healthyIndex < 0 || !Number.isFinite(healthyDurationMs) || healthyDurationMs < 3 * 60 * 60_000)
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_HISTORY_INSUFFICIENT");

const successorBundle = protectedFile(successorBundlePath);
const successorManifest = JSON.parse(execFileSync("unzip", ["-p", successorBundlePath,
  "gateway_remediation_heartbeat_login.json"], { encoding: "utf8", timeout: 15_000, maxBuffer: 16_384 }));
if (!verifyEdgeUpdateManifest(successorManifest, trusted).ok ||
  successorManifest.release_id !== successorItem.releaseId ||
  successorManifest.artifact_sha256 !== successorItem.digest ||
  successorManifest.compatibility?.minimum_current_version !== bridgeItem.version ||
  successorManifest.compatibility?.maximum_current_version !== bridgeItem.version)
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_SUCCESSOR_INVALID");
const rows = protectedFile(failedPreSoakPath).toString("utf8").trim().split("\n").map(line => JSON.parse(line));
const outage = rows.find(point => point.dvr?.progressing === 0 &&
  point.release?.gateway?.software_version === bridgeItem.version &&
  point.dvr?.session_lifecycle?.last_rotation_reason === "proactive_nonexclusive_renewal" &&
  point.dvr?.recorder_session?.authentication_rejected === 0 && point.dvr?.liveness?.ok === true);
if (rows.length < 25 || !outage)
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_REMEDIATION_EVIDENCE_INVALID");

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== connectorItem.releaseId ||
  !connectorManager.knownGood().some(item => item.release_id === connectorItem.releaseId))
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'bridge_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${bridgeItem.releaseId}'),
  'bridge_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${bridgeItem.releaseId}'),
  'bridge_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${bridgeItem.releaseId}'),
  'successor_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'successor_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'successor_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${successorItem.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0));`));
const exactTargets = { explicit_device_ids: [bridgeItem.deviceId] };
if (rollout.bridge_status !== "PAUSED" || rollout.bridge_cohort !== 0 ||
  JSON.stringify(rollout.bridge_targets) !== JSON.stringify(exactTargets) ||
  rollout.successor_status !== "DRAFT" || rollout.successor_cohort !== 0 ||
  JSON.stringify(rollout.successor_targets) !== JSON.stringify(exactTargets) || rollout.broad_active !== 0)
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_ROLLOUT_STATE_INVALID");

const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 3; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map(item => item.pid)).size !== 1 || gatewaySamples.some(item =>
  item.http !== 200 || item.status !== "degraded" || item.assigned !== 10 || item.connected !== 9 ||
  item.failed !== 1 || item.empty !== 6 || item.progressing !== 9 || item.stalled !== 0 ||
  item.version !== rollbackVersion) || new Set(connectorSamples.map(item => item.pid)).size !== 1 ||
  connectorSamples.some(item => item.http !== 200 || !item.ok || item.assigned !== 1 ||
    item.connected !== 1 || item.progressing !== 1 || item.stalled !== 0 || item.version !== connectorItem.version))
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_RUNTIME_NOT_STABLE");

const plan = { protocol: "observer-push38-gateway-session-drain-bridge-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: bridgeItem.releaseId,
  version: bridgeItem.version, artifact_sha256: bridgeItem.digest,
  exact_device_id: bridgeItem.deviceId, prior_failure: failure,
  current_release_id: rollbackReleaseId, current_artifact_sha256: current.artifact_sha256,
  prior_candidate_healthy_duration_ms: healthyDurationMs,
  successor_release_id: successorItem.releaseId, successor_manifest_sha256: sha(successorBundle),
  failed_pre_soak_evidence_sha256: sha(protectedFile(failedPreSoakPath)),
  failure_root_cause: "PROACTIVE_RECORDER_LOGIN_RENEWAL_WITH_ACTIVE_MEDIA",
  bridge_maximum_minutes: 10, gateway_runtime_pid: gatewaySamples.at(-1).pid,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  signed_bridge_manifest: "PASS", signed_successor_manifest: "PASS", live_trust: "PASS",
  exact_targeting: true, broad_cohort: false,
  actions: ["ACTIVATE_EXACT_SIGNED_0_2_19_BRIDGE", "OTA_AGENT_HEALTH_GATE",
    "ACTIVATE_SIGNED_0_2_20_SUCCESSOR_WITHIN_10_MINUTES"], runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_SESSION_DRAIN_BRIDGE_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, healthy_hours: Number((healthyDurationMs / 3_600_000).toFixed(2)),
    exact_device: true, broad_cohort: false, runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256) || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== bridgeItem.releaseId ||
  saved.successor_release_id !== successorItem.releaseId || saved.current_release_id !== rollbackReleaseId ||
  saved.gateway_runtime_pid !== gatewaySamples.at(-1).pid || saved.ota_agent_pid !== plan.ota_agent_pid ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_GATEWAY_SESSION_DRAIN_BRIDGE_PLAN_STALE");
const activateBridge = `begin;
update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
where release_id in (select id from public.observer_edge_releases where channel='HOME_QA' and deployment_profile='PHYSICAL_GATEWAY')
  and status in ('DRAFT','ACTIVE');
update public.observer_edge_rollouts set status='ACTIVE',paused_reason=null,updated_at=now()
where release_id=(select id from public.observer_edge_releases where release_id='${bridgeItem.releaseId}')
  and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${bridgeItem.deviceId}');
do $$ begin if not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
  where r.release_id='${bridgeItem.releaseId}' and o.status='ACTIVE' and o.cohort_percent=0
  and o.target_filters->'explicit_device_ids'=jsonb_build_array('${bridgeItem.deviceId}')) or
  exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0)
then raise exception 'P38_GATEWAY_SESSION_DRAIN_BRIDGE_ACTIVATION_FAILED'; end if; end $$; commit;`;
const revertBridge = `begin;
update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
where release_id=(select id from public.observer_edge_releases where release_id='${bridgeItem.releaseId}');
update public.observer_edge_rollouts set status='DRAFT',updated_at=now()
where release_id=(select id from public.observer_edge_releases where release_id='${successorItem.releaseId}'); commit;`;
docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres"], activateBridge);
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest: bridgeManifest,
    expectedFailureCategory: failure, remediationEvidenceSha256: planSha256 });
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    exact_bridge_rollout_active: true, successor_waiting: true,
    ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_SESSION_DRAIN_BRIDGE_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, bridge_release_id: bridgeItem.releaseId,
    successor_release_id: successorItem.releaseId, exact_device: true, broad_cohort: false,
    ota_agent_owns_install: true, runtime_writes: 0 }));
} catch (error) {
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres"], revertBridge);
  throw error;
}
