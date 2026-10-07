// Authorize one exact retry of signed Gateway 0.2.88 after the installed OTA
// agent was upgraded to use the runtime's minimal /health/live contract for
// late crash-loop detection. The installed OTA agent remains the sole owner
// of download, install, health promotion, quarantine, and rollback.
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
import { PUSH38_MANAGED_AUTH_CONTINUITY } from
  "../../services/video-gateway/push38-home-qa-managed-auth-continuity.mjs";

const retryItem = Object.freeze({
  releaseId: "qa-p38-health-gateway-rejected-hls-continuity-9e07e63a5e3e",
  version: "0.2.88-p38-health",
  buildSha: "25b9affba6fad2c019c56b8d49ef3c2c25f554e4",
  digest: "9e07e63a5e3e27f64712986fe1ffcd1c485f258ce614af00e93050046ef1e8e8",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-session-retirement-4409dc49c483",
  rollbackVersion: "0.2.87-p38-health"
});
const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
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
  throw new Error("P38_GATEWAY_0_2_88_RETRY_MODE_OR_OUTPUT_INVALID");

const sha = value => createHash("sha256").update(value).digest("hex");
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_0_2_88_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
async function healthSample(port, label) {
  const pid = servicePid(label);
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  return { http: response.status, pid, ok: body.ok === true, status: body.status || null,
    reason_codes: body.health_reason_codes || [],
    assigned: body.lastDiscovery?.assignedCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    failed: body.lastDiscovery?.failedAssignedCount ?? null,
    empty: body.lastDiscovery?.unassignedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    version: body.edgeRuntime?.software_version || null,
    build_sha: body.edgeRuntime?.build_sha || null,
    authentication_rejected: body.recorderSessionHeartbeat?.authentication_rejected ?? 0 };
}
function gatewaySafe(sample) {
  return sample.http === 200 && ["healthy", "recovering", "degraded"].includes(sample.status) &&
    sample.assigned === 10 && sample.empty === 6 && sample.connected >= 9 &&
    sample.failed === 10 - sample.connected && sample.progressing >= 7 &&
    sample.progressing <= sample.connected &&
    sample.stalled <= 1 && sample.version === retryItem.rollbackVersion &&
    sample.authentication_rejected === 0;
}
function connectorSafe(sample) {
  const item = PUSH38_MANAGED_AUTH_CONTINUITY.connector;
  return sample.http === 200 && sample.ok && sample.status === "healthy" &&
    sample.assigned === 1 && sample.connected === 1 && sample.failed === 0 &&
    sample.empty === 0 && sample.progressing === 1 && sample.stalled === 0 &&
    sample.version === item.version;
}

const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root: gatewayRoot, trustedPublicKeys: trusted,
  device: { deviceId: retryItem.deviceId, profile: retryItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: retryItem.rollbackVersion,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifest = JSON.parse(readFileSync(join(gatewayRoot, "slots", retryItem.version, "release.json"), "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const current = manager.current(), knownGood = manager.knownGood(), state = manager.status();
const quarantined = manager.quarantine().find(entry => entry.release_id === retryItem.releaseId);
const priorRetries = manager.readJson(manager.quarantineRetryPath, [])
  .filter(entry => entry.release_id === retryItem.releaseId);
if (!verified.ok || manifest.release_id !== retryItem.releaseId || manifest.version !== retryItem.version ||
  manifest.build_sha !== retryItem.buildSha || manifest.artifact_sha256 !== retryItem.digest ||
  manifest.compatibility?.minimum_current_version !== retryItem.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== retryItem.rollbackVersion ||
  current.release_id !== retryItem.rollbackReleaseId || current.version !== retryItem.rollbackVersion ||
  !knownGood.some(entry => entry.release_id === current.release_id &&
    entry.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== retryItem.releaseId ||
  !state.history?.some(entry => ["ROLLBACK_REQUIRED", "ROLLING_BACK"].includes(entry.state) &&
    entry.category === FAILURE) || quarantined?.reason !== FAILURE || priorRetries.length !== 0)
  throw new Error("P38_GATEWAY_0_2_88_RETRY_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: retryItem.version, slot: join(gatewayRoot, "slots", retryItem.version),
  release_id: retryItem.releaseId, artifact_sha256: retryItem.digest });

const agentPath = join(gatewayRoot, "agent", "edge-installed-ota-agent.mjs");
const adapterPath = join(gatewayRoot, "agent", "edge-macos-installed-adapter.mjs");
const agentBytes = readFileSync(agentPath), adapterBytes = readFileSync(adapterPath);
const agentSource = agentBytes.toString("utf8"), adapterSource = adapterBytes.toString("utf8");
if (!agentSource.includes("live.ok && service.running") ||
  !adapterSource.includes("/health/live") || adapterSource.includes("/health/live/full"))
  throw new Error("P38_GATEWAY_0_2_88_RETRY_LIVENESS_FIX_NOT_INSTALLED");

const connectorItem = PUSH38_MANAGED_AUTH_CONTINUITY.connector;
const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: connectorItem.configVersion, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
if (connectorManager.current().release_id !== connectorItem.releaseId ||
  !connectorManager.knownGood().some(entry => entry.release_id === connectorItem.releaseId))
  throw new Error("P38_GATEWAY_0_2_88_RETRY_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorManager.current());

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${retryItem.releaseId}'),
  'cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${retryItem.releaseId}'),
  'targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${retryItem.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0));`));
if (rollout.status !== "PAUSED" || rollout.cohort !== 0 || rollout.broad_active !== 0 ||
  JSON.stringify(rollout.targets) !== JSON.stringify({ explicit_device_ids: [retryItem.deviceId] }))
  throw new Error("P38_GATEWAY_0_2_88_RETRY_ROLLOUT_INVALID");

const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 5; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 4) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (new Set(gatewaySamples.map(entry => entry.pid)).size !== 1 ||
  gatewaySamples.some(entry => !gatewaySafe(entry)) ||
  gatewaySamples.slice(-2).some(entry => entry.progressing !== entry.connected ||
    entry.status !== "healthy") ||
  new Set(connectorSamples.map(entry => entry.pid)).size !== 1 ||
  connectorSamples.some(entry => !connectorSafe(entry)))
  throw new Error(`P38_GATEWAY_0_2_88_RETRY_RUNTIME_UNSAFE:${JSON.stringify({ gatewaySamples, connectorSamples })}`);

const plan = { protocol: "observer-push38-gateway-0-2-88-liveness-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: retryItem.releaseId,
  version: retryItem.version, build_sha: retryItem.buildSha, artifact_sha256: retryItem.digest,
  exact_device_id: retryItem.deviceId, previous_failure: FAILURE,
  current_release_id: retryItem.rollbackReleaseId, authorization_attempt: 1,
  remediation: "INSTALLED_OTA_AGENT_USES_MINIMAL_RUNTIME_LIVENESS_FOR_LATE_CRASH_GUARD",
  agent_sha256: sha(agentBytes), adapter_sha256: sha(adapterBytes),
  signed_retry_manifest: "PASS", live_trust: "PASS", exact_targeting: true,
  broad_cohort: false, gateway_samples: gatewaySamples, connector_samples: connectorSamples,
  ota_agent_pid: servicePid("com.ganbatuach.video-gateway.ota-agent"),
  actions: ["AUTHORIZE_ONE_TIME_EXACT_0_2_88_RETRY", "ACTIVATE_EXACT_0_2_88_ROLLOUT",
    "OTA_AGENT_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK"],
  camera_runtime_writes_by_command: 0, ota_agent_owns_install: true };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_0_2_88_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: retryItem.releaseId, exact_device: true,
    broad_cohort: false, camera_runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_0_2_88_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
const planAge = Date.now() - Date.parse(saved.generated_at || "");
if (saved.protocol !== plan.protocol || saved.release_id !== retryItem.releaseId ||
  saved.current_release_id !== retryItem.rollbackReleaseId ||
  saved.agent_sha256 !== plan.agent_sha256 || saved.adapter_sha256 !== plan.adapter_sha256 ||
  saved.exact_targeting !== true || saved.broad_cohort !== false ||
  !Number.isFinite(planAge) || planAge < -300_000 || planAge > 10 * 60_000)
  throw new Error("P38_GATEWAY_0_2_88_RETRY_PLAN_INVALID");

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
      then raise exception 'P38_GATEWAY_0_2_88_RETRY_ACTIVATION_FAILED'; end if;
    end $$;
  commit;`;
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(gatewayRoot, "slots", retryItem.version)),
    exact_retry_rollout_active: true, camera_runtime_writes_by_command: 0,
    ota_agent_owns_install: true };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_0_2_88_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: retryItem.releaseId, exact_device: true,
    broad_cohort: false, ota_agent_owns_install: true, camera_runtime_writes: 0 }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
