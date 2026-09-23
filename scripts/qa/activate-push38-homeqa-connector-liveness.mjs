// Activate the exact AWS-signed Connector liveness release only after a
// protected, pinned preflight. The installed OTA agent remains the sole
// downloader/installer and the signed transition remains the rollback target.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statfsSync, statSync,
  writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_CONNECTOR_LIVENESS_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-liveness.mjs";

const item = PUSH38_CONNECTOR_LIVENESS_RECOVERY;
const transitionRelease = "qa-connector-legacy-transition-v2-6e7988808b05";
const failedRelease = "qa-p38-health-connector-startup-d44b7e4262f9";
const failedReason = "EDGE_UPDATE_CRASH_LOOP";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const configPath = join(root, "agent-config.json");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const bundle = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-liveness-35806083284.zip";
const artifact = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-remediation-d40c9467/connector-remediation.tar.gz";
const publication = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-remediation-d40c9467/r2-publication.json";
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" : process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha = option("plan-sha256");
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_LIVENESS_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_LIVENESS_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function protectedLocalFile(path) {
  if (!path || !existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    realpathSync(path) !== resolve(path) || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_LIVENESS_LOCAL_FILE_UNSAFE");
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
function service(label) {
  const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${label}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: text.includes("state = running"), pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null };
}
function tlsProbe(path) {
  return new Promise((accept, reject) => {
    const req = httpsRequest({ hostname: "127.0.0.1", port: 3101, path, method: "GET",
      ca: readFileSync(config.qaTlsCaPath), rejectUnauthorized: true, timeout: 8_000 }, response => {
      response.resume(); response.on("end", () => accept(response.statusCode));
    });
    req.on("timeout", () => req.destroy(new Error("P38_CONNECTOR_LIVENESS_TLS_TIMEOUT")));
    req.on("error", reject); req.end();
  });
}
async function runtimeSample() {
  const live = service("com.ganbatuach.software-connector.tapo");
  const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("P38_CONNECTOR_LIVENESS_RUNTIME_UNAVAILABLE");
  const health = await response.json();
  return { pid: live.pid, running: live.running, ok: health.ok === true, status: health.status || null,
    expected: health.lastDiscovery?.channelCount ?? null,
    connected: health.lastDiscovery?.connectedCount ?? null,
    progressing: health.mediaHeartbeat?.progressingRelays ?? null,
    stalled: health.mediaHeartbeat?.stalledRelays ?? null };
}

for (const path of [bundle, artifact, publication]) protectedFile(path);
const config = JSON.parse(protectedLocalFile(configPath).toString("utf8"));
if (config.profile !== "SOFTWARE_CONNECTOR" || config.deviceId !== item.deviceId ||
  config.channel !== "HOME_QA" || config.managedRoot !== root || config.port !== 18083 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_CONNECTOR_LIVENESS_CONFIG_MISMATCH");
if (sha(protectedLocalFile(config.qaTlsCaPath)) !== config.qaTlsCaSha256)
  throw new Error("P38_CONNECTOR_LIVENESS_TLS_PIN_MISMATCH");

const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle, "connector_remediation_liveness.json"],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 16_384 }));
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const publicationProof = JSON.parse(readFileSync(publication, "utf8"));
const expectedObject = `home-qa/${item.releaseId}/${item.digest}.tar.gz`;
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== item.releaseId ||
  manifest.version !== item.version || manifest.build_sha !== item.buildSha ||
  manifest.artifact_sha256 !== item.digest || manifest.artifact_size !== item.size ||
  manifest.profile !== item.profile || manifest.channel !== "HOME_QA" ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]) ||
  manifest.rollout?.cohort_percent !== 0 || manifest.signing_key_id !== "observer-kms-release-v1" ||
  assertEdgeReleaseObjectUrl(manifest, "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com") !== expectedObject ||
  statSync(artifact).size !== item.size || sha(readFileSync(artifact)) !== item.digest ||
  publicationProof.release_id !== item.releaseId || publicationProof.object_key !== expectedObject ||
  publicationProof.artifact_sha256 !== item.digest || publicationProof.bytes !== item.size ||
  publicationProof.round_trip !== "PASS" || publicationProof.anonymous_access_denied !== true)
  throw new Error("P38_CONNECTOR_LIVENESS_RELEASE_INVALID");

const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}",
  "supabase_db_gan-batuach-push38t"]));
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" || network !== "127.0.0.1")
  throw new Error("P38_CONNECTOR_LIVENESS_DATABASE_NOT_ISOLATED");

const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
const current = manager.current(), knownGood = manager.knownGood();
const failed = manager.quarantine().find(entry => entry.release_id === failedRelease);
if (current.release_id !== transitionRelease || knownGood.length !== 1 ||
  knownGood[0].release_id !== transitionRelease || failed?.reason !== failedReason ||
  manager.quarantine().some(entry => entry.release_id === item.releaseId))
  throw new Error("P38_CONNECTOR_LIVENESS_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'releases',(select count(*) from public.observer_edge_releases where channel='HOME_QA'),
  'new_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'new_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'new_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'failed_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${failedRelease}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0),
  'managed_phase',(select metadata->>'home_qa_phase' from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'),
  'managed_identity',(select identity_scheme from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'),
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e join public.observer_managed_device_credentials c on c.enrollment_id=e.id and c.credential_version=e.credential_version where e.gateway_id='${item.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered' and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '2 minutes' and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id and n.credential_version=e.credential_version and n.observed_at>=now()-interval '2 minutes')));`));
if (rollout.devices !== 2 || rollout.releases !== 8 || rollout.new_status !== "DRAFT" ||
  rollout.new_cohort !== 0 || JSON.stringify(rollout.new_targets) !== JSON.stringify({ explicit_device_ids: [item.deviceId] }) ||
  rollout.failed_status !== "PAUSED" || rollout.broad_active !== 0 ||
  rollout.managed_phase !== "MANAGED_IDENTITY_VERIFIED" || rollout.managed_identity !== "ED25519_V1" ||
  rollout.fresh_proof !== 1)
  throw new Error("P38_CONNECTOR_LIVENESS_HOME_QA_STATE_INVALID");

const runtime = service("com.ganbatuach.software-connector.tapo");
const agent = service("com.ganbatuach.software-connector.tapo.ota-agent");
if (!runtime.running || !runtime.pid || !agent.running || !agent.pid)
  throw new Error("P38_CONNECTOR_LIVENESS_SERVICE_MANAGER_INVALID");
const samples = [];
for (let index = 0; index < 3; index += 1) {
  samples.push(await runtimeSample());
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
if (samples.some(sample => !sample.running || !sample.pid || !sample.ok || sample.expected !== 1) ||
  new Set(samples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_CONNECTOR_LIVENESS_RUNTIME_UNSTABLE");
const disk = statfsSync(root);
if (Number(disk.bavail) * Number(disk.bsize) < item.size * 3)
  throw new Error("P38_CONNECTOR_LIVENESS_DISK_INSUFFICIENT");
const [anonymous, wrongRoute] = await Promise.all([
  tlsProbe("/api/video-gateway/edge-updates?platform=darwin&architecture=arm64&profile=SOFTWARE_CONNECTOR&current_version=0.1.0-legacy&config_version=4&channel=HOME_QA"),
  tlsProbe("/api/video-gateway/not-exposed")
]);
if (anonymous !== 401 || wrongRoute !== 404) throw new Error("P38_CONNECTOR_LIVENESS_INGRESS_INVALID");

const plan = { protocol: "observer-push38-connector-liveness-activation-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: item.releaseId,
  version: item.version, build_sha: item.buildSha, artifact_sha256: item.digest,
  artifact_size: item.size, r2_object_key: expectedObject, exact_device_id: item.deviceId,
  cohort_percent: 0, signed_manifest: "PASS", live_trust: "PASS", r2_round_trip: "PASS",
  private_r2: "PASS", managed_device_auth: "PASS", https_control: "PASS",
  current_release_id: current.release_id, rollback_target: transitionRelease,
  quarantined_failed_release: failedRelease, runtime_pid: runtime.pid, ota_agent_pid: agent.pid,
  current_runtime_samples: samples, tapo_pre_remediation: samples.at(-1),
  actions: ["PAUSE_OTHER_CONNECTOR_ROLLOUTS", "ACTIVATE_EXACT_LIVENESS_ROLLOUT",
    "OTA_AGENT_DISCOVERS", "SHORT_LIVED_R2_DOWNLOAD", "SIGNED_INSTALL", "HEALTH_GATE",
    "PROMOTE_OR_EXISTING_MANAGER_ROLLBACK"], runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "LIVENESS_PREFLIGHT_PASS", evidence_sha256: evidenceSha,
    release_id: item.releaseId, exact_device: true, broad_cohort: false,
    tapo_progressing: samples.at(-1).progressing, runtime_writes: 0 }));
  process.exit(0);
}

const savedBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha) || sha(savedBytes) !== planSha)
  throw new Error("P38_CONNECTOR_LIVENESS_PLAN_PIN_MISMATCH");
const saved = JSON.parse(savedBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.artifact_sha256 !== item.digest || saved.current_release_id !== transitionRelease ||
  saved.rollback_target !== transitionRelease || saved.runtime_pid !== runtime.pid ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_CONNECTOR_LIVENESS_PLAN_STALE");
const sql = `begin;
  update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
  where release_id in (select id from public.observer_edge_releases where channel='HOME_QA' and deployment_profile='SOFTWARE_CONNECTOR')
    and status in ('DRAFT','ACTIVE');
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
    then raise exception 'P38_CONNECTOR_LIVENESS_ACTIVATION_VERIFY_FAILED'; end if;
  end $$;
commit;`;
docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres"], sql);
const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(),
  exact_rollout_active: true, broad_cohort: false, ota_agent_owns_install: true,
  functional_runtime_changed_by_command: false, runtime_writes: 0 };
const evidenceSha = persist(result);
console.log(JSON.stringify({ status: "EXACT_LIVENESS_ROLLOUT_ACTIVE", evidence_sha256: evidenceSha,
  release_id: item.releaseId, exact_device: true, broad_cohort: false,
  ota_agent_owns_install: true, runtime_writes: 0 }));
