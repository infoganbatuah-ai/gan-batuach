// Authorize one exact retry of the AWS-signed 0.2.32 Connector release after
// unrelated host pressure was removed and the signed 0.2.26 known-good slot
// was re-verified. The installed OTA agent remains the sole downloader,
// installer, health gate, promoter and rollback owner.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync,
  writeFileSync } from "node:fs";
import { availableParallelism, homedir, loadavg } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createEdgeCrashLoopGuard } from "../../services/video-gateway/edge-crash-loop-guard.mjs";
import { createMacOSInstalledEdgeAdapter } from
  "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { deriveInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from
  "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_CONNECTOR_LIVENESS_ISOLATION as item } from
  "../../services/video-gateway/push38-home-qa-connector-liveness-isolation.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const LABEL = "com.ganbatuach.software-connector.tapo";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const CONFIG_PATH = join(ROOT, "agent-config.json");
const SLOT = join(ROOT, "slots", item.version);
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || !outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path, { restricted = true } = {}) {
  if (!path || !existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    realpathSync(path) !== resolve(path) || (statSync(path).mode & 0o077) !== 0 ||
    (restricted && !realpathSync(path).startsWith(RESTRICTED_ROOT)))
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_PROTECTED_FILE_REQUIRED");
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
function launchd() {
  const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${LABEL}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: text.includes("state = running"),
    pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null,
    version: /OBSERVER_EDGE_VERSION => ([^\s]+)/.exec(text)?.[1] || null };
}
async function sampleHealth() {
  const runtime = launchd(), startedAt = Date.now();
  const response = await fetch("http://127.0.0.1:18083/health",
    { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_RUNTIME_UNAVAILABLE");
  const body = await response.json();
  return { observed_at: new Date().toISOString(), latency_ms: Date.now() - startedAt,
    pid: runtime.pid, running: runtime.running, version: runtime.version,
    ok: body.ok === true, status: body.status || null,
    expected: body.lastDiscovery?.channelCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    supervision_crash_loops: body.supervision?.crashLoops ?? body.supervision?.crash_loops ?? 0,
    health_reason_codes: Array.isArray(body.health_reason_codes) ? body.health_reason_codes : [],
    event_loop_p99_ms: body.eventLoop?.delay_p99_ms ?? null,
    source_reason: body.sourceDiagnostics?.[0]?.reason ||
      body.mediaHeartbeat?.relayStates?.[0]?.failureReason || body.lastDiscovery?.reason || null };
}

protectedFile(CONFIG_PATH, { restricted: false });
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
if (config.profile !== item.profile || config.deviceId !== item.deviceId || config.channel !== "HOME_QA" ||
  config.managedRoot !== ROOT || config.port !== 18083 || !config.secretDir || !config.qaTlsCaPath ||
  !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_CONFIG_MISMATCH");
const tlsChild = process.argv.includes("--tls-child");
if (!tlsChild) {
  const certificate = config.qaTlsCaPath;
  if (!existsSync(certificate) || lstatSync(certificate).isSymbolicLink() || !lstatSync(certificate).isFile() ||
    realpathSync(certificate) !== resolve(certificate) || (statSync(certificate).mode & 0o022) !== 0 ||
    sha(readFileSync(certificate)) !== config.qaTlsCaSha256)
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_TLS_CERTIFICATE_INVALID");
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--tls-child"],
    { env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate }, stdio: "inherit", timeout: 240_000 });
  process.exit(0);
}
if (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath))
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_TLS_PROCESS_INVALID");

const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manifest = JSON.parse(readFileSync(join(SLOT, "release.json"), "utf8"));
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== item.releaseId ||
  manifest.version !== item.version || manifest.build_sha !== item.buildSha ||
  manifest.artifact_sha256 !== item.digest || manifest.artifact_size !== item.size ||
  manifest.compatibility?.minimum_current_version !== item.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== item.rollbackVersion ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]) ||
  manifest.rollout?.cohort_percent !== 0)
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_MANIFEST_INVALID");

const adapter = createMacOSInstalledEdgeAdapter({ profile: item.profile,
  installedBase: config.installedBase, managedRoot: ROOT, launchAgentPath: config.launchAgentPath,
  label: config.label, port: config.port });
const store = createEdgeSecretStoreSync({ keychainService: config.keychainService,
  secretDir: config.secretDir || "" });
const healthCheck = async () => {
  const session = await softwareConnectorDeviceSession(store);
  if (session.authMode !== "ED25519_V1" || session.gatewayId !== item.deviceId)
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_MANAGED_PROOF_INVALID");
  const probe = await adapter.health({ timeoutMs: 8_000 });
  return deriveInstalledEdgeHealth({ profile: item.profile, expected: 1, configured: 1,
    probe, cloudReachable: true, managedDeviceAuthenticated: true });
};
const manager = new EdgeUpdateManager({ root: ROOT, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: item.rollbackVersion,
    configVersion: 4, revoked: false }, adapter, healthCheck });
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
const originalFailurePreserved = (state.history || []).some(entry =>
  ["ROLLBACK_REQUIRED", "ROLLING_BACK"].includes(entry.state) && entry.category === FAILURE);
if (!((state.state === "ACTION_REQUIRED" && state.failure_category === "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP") ||
    state.state === "ROLLED_BACK") || state.release_id !== item.releaseId || !originalFailurePreserved ||
  current.release_id !== item.rollbackReleaseId || current.version !== item.rollbackVersion ||
  !knownGood.some(entry => entry.release_id === item.rollbackReleaseId &&
    entry.artifact_sha256 === current.artifact_sha256) ||
  !manager.quarantine().some(entry => entry.release_id === item.releaseId &&
    entry.version === item.version && entry.reason === FAILURE) ||
  manager.readJson(manager.quarantineRetryPath, []).some(entry => entry.release_id === item.releaseId))
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: item.version, slot: SLOT, release_id: item.releaseId,
  artifact_sha256: item.digest });

const qa = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'release_state',r.release_state,'rollout_status',o.status,'cohort_percent',o.cohort_percent,
  'target_filters',o.target_filters,'artifact_sha256',r.artifact_sha256,
  'signing_key_id',r.signing_key_id,
  'active_connector_release',(select r2.release_id from public.observer_edge_rollouts o2
    join public.observer_edge_releases r2 on r2.id=o2.release_id
    where o2.status='ACTIVE' and r2.channel='HOME_QA' and r2.deployment_profile='SOFTWARE_CONNECTOR'
    limit 1),
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e
    join public.observer_managed_device_credentials c on c.enrollment_id=e.id
      and c.credential_version=e.credential_version
    where e.gateway_id='${item.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered'
      and e.identity_scheme='ED25519_V1' and c.credential_state='ACTIVE'
      and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '2 minutes'
      and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id
        and n.credential_version=e.credential_version and n.observed_at>=now()-interval '2 minutes')),
  'broad_active',(select count(*) from public.observer_edge_rollouts
    where status='ACTIVE' and cohort_percent>0))::text
  from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
  where r.release_id='${item.releaseId}'`));
if (qa.devices !== 2 || qa.release_state !== "PUBLISHED" || !["ACTIVE", "PAUSED"].includes(qa.rollout_status) ||
  qa.cohort_percent !== 0 ||
  JSON.stringify(qa.target_filters) !== JSON.stringify({ explicit_device_ids: [item.deviceId] }) ||
  qa.artifact_sha256 !== item.digest || qa.signing_key_id !== manifest.signing_key_id ||
  (qa.active_connector_release && qa.active_connector_release !== item.releaseId) ||
  qa.fresh_proof !== 1 || qa.broad_active !== 0)
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_HOME_QA_INVALID");

const samples = [];
for (let index = 0; index < 10; index += 1) {
  samples.push(await sampleHealth());
  if (index < 9) await new Promise(resolveWait => setTimeout(resolveWait, 3_000));
}
const healthy = sample => sample.ok && sample.status === "healthy" && sample.connected === 1 &&
  sample.progressing === 1 && sample.stalled === 0 && sample.health_reason_codes.length === 0;
const truthfulDegraded = sample => sample.ok === false && sample.status === "degraded" &&
  sample.connected === 0 && sample.progressing === 0 && sample.stalled === 1 &&
  sample.health_reason_codes.includes("EXPECTED_RELAY_NOT_PROGRESSING") &&
  ["STALE_INPUT", "DISCOVERY_PROBE_FAILED", "SOURCE_UNREACHABLE"].some(reason =>
    sample.source_reason === reason || sample.health_reason_codes.includes(reason));
if (samples.some(sample => !sample.running || !sample.pid || sample.version !== item.rollbackVersion ||
  (!healthy(sample) && !truthfulDegraded(sample)) || sample.expected !== 1 ||
  sample.supervision_crash_loops !== 0 || sample.latency_ms > 2_000 ||
  !Number.isFinite(sample.event_loop_p99_ms) || sample.event_loop_p99_ms > 2_000) ||
  new Set(samples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_CURRENT_RUNTIME_UNSTABLE");
const agentText = execFileSync("/bin/launchctl", ["print",
  `gui/${process.getuid()}/com.ganbatuach.software-connector.tapo.ota-agent`],
{ encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
if (!agentText.includes("state = running") || !/\bpid = \d+/.test(agentText))
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_AGENT_UNAVAILABLE");
const host = { logical_cpus: availableParallelism(), load_1m: loadavg()[0],
  load_5m: loadavg()[1], load_15m: loadavg()[2] };
if (host.load_1m > host.logical_cpus * 3)
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_HOST_SATURATED");

const plan = { protocol: "observer-push38-connector-liveness-isolation-host-recovery-retry-v1",
  generated_at: new Date().toISOString(), release_id: item.releaseId, version: item.version,
  artifact_sha256: item.digest, previous_failure_category: FAILURE,
  rollback_recovery_category: state.failure_category, current_release_id: current.release_id,
  rollback_target: item.rollbackReleaseId, exact_device_id: item.deviceId, cohort_percent: 0,
  signed_manifest: "PASS", live_trust: "PASS", managed_device_auth: "PASS",
  current_runtime_samples: samples, host_pressure: host,
  host_remediation: ["FSEVENTS_RESTARTED_WITH_SIP_PRESERVED",
    "ORPHAN_COLIMA_VM_AND_USERNET_HELPERS_STOPPED", "NONESSENTIAL_DEVELOPMENT_LOAD_STOPPED"],
  ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "CONNECTOR_LIVENESS_ISOLATION_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, exact_device: true, broad_cohort: false,
    samples: samples.length, runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.artifact_sha256 !== item.digest || saved.current_release_id !== item.rollbackReleaseId ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_PLAN_STALE");

const activateSql = `begin;
  update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
  where release_id in (select id from public.observer_edge_releases
    where channel='HOME_QA' and deployment_profile='SOFTWARE_CONNECTOR') and status='ACTIVE';
  update public.observer_edge_rollouts set status='ACTIVE',paused_reason=null,updated_at=now()
  where release_id=(select id from public.observer_edge_releases where release_id='${item.releaseId}')
    and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}');
  do $$ begin
    if not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
      where r.release_id='${item.releaseId}' and o.status='ACTIVE' and o.cohort_percent=0
      and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')) or
      exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0) or
      exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
        where r.deployment_profile='SOFTWARE_CONNECTOR' and r.release_id<>'${item.releaseId}' and o.status='ACTIVE')
    then raise exception 'P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_ACTIVATION_VERIFY_FAILED'; end if;
  end $$;
commit;`;
const pauseSql = `update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
  where release_id=(select id from public.observer_edge_releases where release_id='${item.releaseId}');`;
let rolloutActivated = false;
try {
  docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], activateSql);
  rolloutActivated = true;
  let recovery = null, guard = null;
  if (manager.status().state === "ACTION_REQUIRED") {
    recovery = await manager.recoverKnownGoodCrashLoopAfterStability();
    guard = createEdgeCrashLoopGuard({ statePath: join(ROOT, "crash-guard.json"), manager })
      .reconcileVerifiedRecovery({ runtimePid: adapter.runtimePid() });
  }
  if (manager.status().state !== "ROLLED_BACK")
    throw new Error("P38_CONNECTOR_LIVENESS_ISOLATION_RETRY_RECOVERY_FAILED");
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), recovery,
    crash_guard: guard?.action || "ALREADY_RECONCILED", authorization,
    failed_slot_removed: !existsSync(SLOT), exact_rollout_active: true, broad_cohort: false,
    ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_CONNECTOR_LIVENESS_ISOLATION_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: item.releaseId, failed_slot_removed: true,
    exact_rollout_active: true, broad_cohort: false, ota_agent_owns_install: true }));
} catch (error) {
  if (rolloutActivated) {
    try { psql(pauseSql); } catch {}
  }
  throw error;
}
