// Authorize one exact retry of the signed Connector RTSP-session remediation
// after host-pressure isolation. The installed OTA agent remains the sole
// installer and the signed 0.2.14 runtime remains the rollback target.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, homedir, loadavg } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY as item } from "../../services/video-gateway/push38-home-qa-connector-rtsp-session.mjs";

const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const configPath = join(root, "agent-config.json");
const agentLog = join(root, "agent.out.log");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" : process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_PROTECTED_EVIDENCE_REQUIRED");
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
function service() {
  const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/com.ganbatuach.software-connector.tapo`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: text.includes("state = running"), pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null };
}
async function sampleHealth() {
  const runtime = service();
  const startedAt = Date.now();
  const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_RUNTIME_UNAVAILABLE");
  const health = await response.json();
  return { observed_at: new Date().toISOString(), latency_ms: Date.now() - startedAt,
    pid: runtime.pid, running: runtime.running, ok: health.ok === true, status: health.status || null,
    expected: health.lastDiscovery?.channelCount ?? null,
    connected: health.lastDiscovery?.connectedCount ?? null,
    progressing: health.mediaHeartbeat?.progressingRelays ?? null,
    stalled: health.mediaHeartbeat?.stalledRelays ?? null,
    health_reason_codes: Array.isArray(health.health_reason_codes) ? health.health_reason_codes : [],
    supervision_crash_loops: health.supervision?.metrics?.crash_loops ?? null,
    event_loop_p99_ms: health.eventLoop?.delay_p99_ms ?? null,
    event_loop_max_ms: health.eventLoop?.delay_max_ms ?? null };
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.profile !== item.profile || config.deviceId !== item.deviceId || config.channel !== "HOME_QA" ||
  config.managedRoot !== root || config.port !== 18083 || !config.secretDir)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_CONFIG_MISMATCH");
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const slot = join(root, "slots", item.version);
const manifest = JSON.parse(readFileSync(join(slot, "release.json"), "utf8"));
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== item.releaseId ||
  manifest.version !== item.version || manifest.artifact_sha256 !== item.digest ||
  manifest.artifact_size !== item.size || manifest.signing_key_id !== "observer-kms-release-v1" ||
  manifest.compatibility?.minimum_current_version !== item.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== item.rollbackVersion)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_MANIFEST_INVALID");

const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: item.rollbackVersion, configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (state.state !== "ROLLED_BACK" || state.release_id !== item.releaseId ||
  !state.history?.some(entry => entry.state === "ROLLBACK_REQUIRED" && entry.category === "EDGE_UPDATE_CRASH_LOOP") ||
  current.release_id !== item.rollbackReleaseId || current.version !== item.rollbackVersion ||
  !knownGood.some(entry => entry.release_id === item.rollbackReleaseId &&
    entry.artifact_sha256 === current.artifact_sha256) ||
  !manager.quarantine().some(entry => entry.release_id === item.releaseId &&
    entry.version === item.version && entry.reason === "EDGE_UPDATE_CRASH_LOOP") ||
  manager.readJson(manager.quarantineRetryPath, []).some(entry => entry.release_id === item.releaseId))
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: item.version, slot, release_id: item.releaseId, artifact_sha256: item.digest });

const priorHealthy = readFileSync(agentLog, "utf8").split("\n").filter(Boolean).flatMap(line => {
  try { const event = JSON.parse(line); return event.state === "HEALTHY" && event.release_id === item.releaseId ? [event] : []; }
  catch { return []; }
});
const priorHealthyDurationMs = Date.parse(priorHealthy.at(-1)?.at || 0) - Date.parse(priorHealthy[0]?.at || 0);
if (priorHealthy.length < 30 || priorHealthyDurationMs < 30 * 60_000)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_PRIOR_HEALTH_INSUFFICIENT");

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'status',o.status,'cohort_percent',o.cohort_percent,'target_filters',o.target_filters,
  'release_state',r.release_state,'artifact_sha256',r.artifact_sha256,'signing_key_id',r.signing_key_id,
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e
    join public.observer_managed_device_credentials c on c.enrollment_id=e.id and c.credential_version=e.credential_version
    where e.gateway_id='${item.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered'
      and e.identity_scheme='ED25519_V1' and c.credential_state='ACTIVE'
      and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '2 minutes'
      and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id
        and n.credential_version=e.credential_version and n.observed_at>=now()-interval '2 minutes')),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent>0))::text
  from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
  where r.release_id='${item.releaseId}'`));
if (rollout.devices !== 2 || rollout.status !== "ACTIVE" || rollout.cohort_percent !== 0 ||
  JSON.stringify(rollout.target_filters) !== JSON.stringify({ explicit_device_ids: [item.deviceId] }) ||
  rollout.release_state !== "PUBLISHED" || rollout.artifact_sha256 !== item.digest ||
  rollout.signing_key_id !== manifest.signing_key_id || rollout.fresh_proof !== 1 || rollout.broad_active !== 0)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_HOME_QA_INVALID");

const samples = [];
for (let index = 0; index < 10; index += 1) {
  samples.push(await sampleHealth());
  if (index < 9) await new Promise(resolveWait => setTimeout(resolveWait, 3_000));
}
if (samples.some(sample => !sample.running || !sample.pid || !["healthy", "degraded"].includes(sample.status) ||
  sample.expected !== 1 || sample.connected !== 1 || sample.supervision_crash_loops !== 0 ||
  (sample.status === "healthy" && !sample.ok) ||
  (sample.status === "degraded" && (sample.ok || sample.health_reason_codes.length < 1 ||
    sample.health_reason_codes.some(reason => reason !== "EXPECTED_RELAY_NOT_PROGRESSING"))) ||
  !Number.isFinite(sample.event_loop_p99_ms) || sample.event_loop_p99_ms > 2_000 ||
  !Number.isFinite(sample.event_loop_max_ms) || sample.latency_ms > 2_000) ||
  new Set(samples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_CURRENT_RUNTIME_UNSTABLE");
const host = { logical_cpus: availableParallelism(), load_1m: loadavg()[0], load_5m: loadavg()[1], load_15m: loadavg()[2] };
if (host.load_1m > host.logical_cpus * 3)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_STILL_SATURATED");

const plan = { protocol: "observer-push38-connector-rtsp-host-pressure-retry-v1",
  generated_at: new Date().toISOString(), release_id: item.releaseId, version: item.version,
  artifact_sha256: item.digest, previous_failure_category: "EDGE_UPDATE_CRASH_LOOP",
  recovery_failure_category: state.failure_category, current_release_id: current.release_id,
  rollback_target: item.rollbackReleaseId, exact_device_id: item.deviceId, cohort_percent: 0,
  signed_manifest: "PASS", live_trust: "PASS", managed_device_auth: "PASS",
  prior_healthy_samples: priorHealthy.length,
  prior_healthy_duration_seconds: Math.floor(priorHealthyDurationMs / 1000),
  current_runtime_samples: samples, host_pressure: host,
  tapo_pre_remediation: samples.at(-1),
  host_pressure_remediation: ["NONESSENTIAL_COLIMA_PROFILES_STOPPED", "STUCK_BROWSER_PROCESS_TERMINATED"],
  runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "RTSP_HOST_PRESSURE_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
    broad_cohort: false, tapo: "1/1", runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.artifact_sha256 !== item.digest || saved.current_release_id !== item.rollbackReleaseId ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_CONNECTOR_RTSP_HOST_PRESSURE_PLAN_STALE");
let authorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: "EDGE_UPDATE_CRASH_LOOP", remediationEvidenceSha256: planSha256 });
  authorized = true;
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(slot), exact_rollout_active: true, broad_cohort: false,
    ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_RTSP_HOST_PRESSURE_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, release_id: item.releaseId, failed_slot_removed: true,
    exact_rollout_active: true, broad_cohort: false, ota_agent_owns_install: true }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, "EDGE_UPDATE_CRASH_LOOP");
  throw error;
}
