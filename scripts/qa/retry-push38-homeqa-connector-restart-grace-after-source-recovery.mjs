// Authorize one exact retry of the signed Connector restart-grace release
// after its first live attempt rolled back on camera progression and the exact
// signed known-good runtime independently restored the same Tapo source to 1/1.
// The installed OTA agent remains the only installer and keeps every normal
// signature, health, promotion, quarantine, and rollback gate.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, homedir, loadavg } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY as item } from "../../services/video-gateway/push38-home-qa-connector-restart-grace.mjs";

const FAILURE = "EDGE_UPDATE_CAMERA_PROGRESSION_FAILED";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const configPath = join(root, "agent-config.json");
const agentReleasePath = join(root, "agent/agent-release.json");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" : process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
  if (!response.ok) throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_RUNTIME_UNAVAILABLE");
  const health = await response.json();
  return { observed_at: new Date().toISOString(), latency_ms: Date.now() - startedAt,
    pid: runtime.pid, running: runtime.running, ok: health.ok === true, status: health.status || null,
    version: health.edgeRuntime?.software_version || null,
    expected: health.lastDiscovery?.channelCount ?? null,
    connected: health.lastDiscovery?.connectedCount ?? null,
    progressing: health.mediaHeartbeat?.progressingRelays ?? null,
    stalled: health.mediaHeartbeat?.stalledRelays ?? null,
    crash_loops: health.supervision?.metrics?.crash_loops ?? null,
    event_loop_p99_ms: health.eventLoop?.delay_p99_ms ?? null,
    health_reason_codes: Array.isArray(health.health_reason_codes) ? health.health_reason_codes : [] };
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const agentRelease = JSON.parse(readFileSync(agentReleasePath, "utf8"));
if (config.profile !== item.profile || config.deviceId !== item.deviceId || config.channel !== "HOME_QA" ||
  config.managedRoot !== root || config.port !== 18083 || !config.secretDir ||
  agentRelease.release_id !== item.releaseId || agentRelease.artifact_sha256 !== item.digest)
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_CONFIG_MISMATCH");

const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const slot = join(root, "slots", item.version);
const manifest = JSON.parse(readFileSync(join(slot, "release.json"), "utf8"));
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== item.releaseId ||
  manifest.version !== item.version || manifest.artifact_sha256 !== item.digest ||
  manifest.artifact_size !== item.size || manifest.signing_key_id !== "observer-kms-release-v1" ||
  manifest.compatibility?.minimum_current_version !== item.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== item.rollbackVersion)
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_MANIFEST_INVALID");

const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: item.rollbackVersion, configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (state.state !== "ROLLED_BACK" || state.release_id !== item.releaseId ||
  state.failure_category !== FAILURE ||
  !state.history?.some(entry => entry.state === "ROLLBACK_REQUIRED" && entry.category === FAILURE) ||
  current.release_id !== item.rollbackReleaseId || current.version !== item.rollbackVersion ||
  !knownGood.some(entry => entry.release_id === item.rollbackReleaseId &&
    entry.artifact_sha256 === current.artifact_sha256) ||
  !manager.quarantine().some(entry => entry.release_id === item.releaseId &&
    entry.version === item.version && entry.reason === FAILURE) ||
  manager.readJson(manager.quarantineRetryPath, []).some(entry => entry.release_id === item.releaseId))
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: item.version, slot, release_id: item.releaseId, artifact_sha256: item.digest });

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'status',o.status,'cohort_percent',o.cohort_percent,'target_filters',o.target_filters,
  'release_state',r.release_state,'artifact_sha256',r.artifact_sha256,'signing_key_id',r.signing_key_id,
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e
    join public.observer_managed_device_credentials c on c.enrollment_id=e.id and c.credential_version=e.credential_version
    where e.gateway_id='${item.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered'
      and e.identity_scheme='ED25519_V1' and c.credential_state='ACTIVE' and c.revoked_at is null
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
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_HOME_QA_INVALID");

const samples = [];
for (let index = 0; index < 6; index += 1) {
  samples.push(await sampleHealth());
  if (index < 5) await new Promise(resolveWait => setTimeout(resolveWait, 5_000));
}
if (samples.some(sample => !sample.running || !sample.pid || !sample.ok || sample.status !== "healthy" ||
  sample.version !== item.rollbackVersion || sample.expected !== 1 || sample.connected !== 1 ||
  sample.progressing !== 1 || sample.stalled !== 0 || sample.crash_loops !== 0 ||
  sample.health_reason_codes.length !== 0 || sample.latency_ms > 2_000) ||
  new Set(samples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_SOURCE_NOT_STABLE");
const host = { logical_cpus: availableParallelism(), load_1m: loadavg()[0], load_5m: loadavg()[1], load_15m: loadavg()[2] };
if (host.load_1m > host.logical_cpus * 3)
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_HOST_SATURATED");

const plan = { protocol: "observer-push38-connector-restart-grace-source-retry-v1",
  generated_at: new Date().toISOString(), release_id: item.releaseId, version: item.version,
  artifact_sha256: item.digest, previous_failure_category: FAILURE,
  current_release_id: current.release_id, rollback_target: item.rollbackReleaseId,
  exact_device_id: item.deviceId, cohort_percent: 0, signed_manifest: "PASS", live_trust: "PASS",
  managed_device_auth: "PASS", source_recovered_on_signed_known_good: "PASS",
  source_recovery_samples: samples, host_pressure: host, runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "RESTART_GRACE_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
    broad_cohort: false, tapo: "1/1", runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256 || "") || sha(planBytes) !== planSha256)
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.artifact_sha256 !== item.digest || saved.current_release_id !== item.rollbackReleaseId ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_CONNECTOR_RESTART_GRACE_RETRY_PLAN_STALE");
const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
  expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
  failed_slot_removed: !existsSync(slot), exact_rollout_active: true, broad_cohort: false,
  ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
const evidenceSha = persist(result);
console.log(JSON.stringify({ status: "EXACT_RESTART_GRACE_RETRY_AUTHORIZED",
  evidence_sha256: evidenceSha, release_id: item.releaseId, failed_slot_removed: true,
  exact_rollout_active: true, broad_cohort: false, ota_agent_owns_install: true }));
