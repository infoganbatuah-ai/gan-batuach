// Activate one exact-device rollout after a protected, pinned preflight. The
// installed OTA agent remains the sole downloader, installer, health gate and
// rollback owner; this tool only changes isolated HOME_QA rollout metadata.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from
  "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_MANAGED_AUTH_CONTINUITY } from
  "../../services/video-gateway/push38-home-qa-managed-auth-continuity.mjs";

const restrictedRoot = `${realpathSync(
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const component = option("component");
const item = PUSH38_MANAGED_AUTH_CONTINUITY[component];
if (!item) throw new Error("P38_MANAGED_AUTH_ACTIVATION_COMPONENT_INVALID");
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" :
  process.argv.includes("--apply") ? "APPLY" : "";
const signedDir = resolve(option("signed-dir") || ".");
const manifestPath = join(signedDir, `${component}_managed_auth_continuity.json`);
const artifactPath = resolve(option("artifact") || ".");
const publicationPath = resolve(option("publication") || ".");
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha = option("plan-sha256");
const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const runtime = component === "connector" ? {
  root: join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota"),
  label: "com.ganbatuach.software-connector.tapo",
  agentLabel: "com.ganbatuach.software-connector.tapo.ota-agent", port: 18083
} : { root: join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota"),
  label: "com.ganbatuach.video-gateway", agentLabel: "com.ganbatuach.video-gateway.ota-agent",
  port: 18082 };

function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_MANAGED_AUTH_ACTIVATION_PROTECTED_INPUT_REQUIRED");
  return readFileSync(path);
}
function localState(name) {
  const path = join(runtime.root, name);
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_MANAGED_AUTH_ACTIVATION_LOCAL_STATE_INVALID");
  return JSON.parse(readFileSync(path, "utf8"));
}
function service(label) {
  const result = execFileSync("launchctl", ["print", `gui/${process.getuid()}/${label}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: /\bstate = running\b/.test(result),
    pid: Number(result.match(/\bpid = (\d+)\b/)?.[1] || 0) };
}
const docker = (args, options = {}) => execFileSync("docker", ["--context", "colima-push38t", ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"], ...options });
const psql = sql => docker(["exec", "supabase_db_gan-batuach-push38t", "psql", "-X", "-qAt",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql]).trim();

const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}",
  "supabase_db_gan-batuach-push38t"]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  docker(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}" ]).trim() !== "127.0.0.1")
  throw new Error("P38_MANAGED_AUTH_ACTIVATION_DATABASE_NOT_ISOLATED");

if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) ||
  existsSync(outputPath)) throw new Error("P38_MANAGED_AUTH_ACTIVATION_MODE_OR_OUTPUT_INVALID");
const manifestBytes = protectedFile(manifestPath);
const artifactBytes = protectedFile(artifactPath);
const publication = JSON.parse(protectedFile(publicationPath));
const manifest = JSON.parse(manifestBytes);
const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const objectKey = `home-qa/${item.releaseId}/${item.digest}.tar.gz`;
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== item.releaseId ||
  manifest.artifact_sha256 !== item.digest || manifest.artifact_size !== item.size ||
  manifest.profile !== item.profile || manifest.channel !== "HOME_QA" ||
  manifest.rollout?.cohort_percent !== 0 ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]) ||
  assertEdgeReleaseObjectUrl(manifest, origin) !== objectKey || artifactBytes.length !== item.size ||
  sha(artifactBytes) !== item.digest || publication.release_id !== item.releaseId ||
  publication.object_key !== objectKey || publication.round_trip !== "PASS" ||
  publication.anonymous_access_denied !== true)
  throw new Error("P38_MANAGED_AUTH_ACTIVATION_RELEASE_INVALID");

const current = localState("current.json"), knownGood = localState("known-good.json");
const updateState = localState("update-state.json");
const config = localState("agent-config.json");
if (current.release_id !== item.rollbackReleaseId || current.version !== item.rollbackVersion ||
  !knownGood.some(value => value.release_id === current.release_id &&
    value.artifact_sha256 === current.artifact_sha256) ||
  !["HEALTHY", "ROLLED_BACK"].includes(updateState.state) || config.deviceId !== item.deviceId ||
  config.profile !== item.profile || config.channel !== "HOME_QA")
  throw new Error("P38_MANAGED_AUTH_ACTIVATION_ROLLBACK_OR_IDENTITY_INVALID");
const componentService = service(runtime.label), agentService = service(runtime.agentLabel);
if (!componentService.running || !componentService.pid || !agentService.running || !agentService.pid)
  throw new Error("P38_MANAGED_AUTH_ACTIVATION_SERVICE_NOT_RUNNING");
const response = await fetch(`http://127.0.0.1:${runtime.port}/health`, {
  signal: AbortSignal.timeout(12_000) });
if (!response.ok) throw new Error("P38_MANAGED_AUTH_ACTIVATION_HEALTH_UNAVAILABLE");
const health = await response.json();
const database = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'rollout_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0),
  'managed_identity',(select identity_scheme from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'),
  'managed_phase',(select metadata->>'home_qa_phase' from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'),
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e join public.observer_managed_device_credentials c on c.enrollment_id=e.id and c.credential_version=e.credential_version where e.gateway_id='${item.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered' and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '3 minutes' and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id and n.credential_version=e.credential_version and n.observed_at>=now()-interval '3 minutes')));`));
if (database.devices !== 2 || !["DRAFT", "ACTIVE"].includes(database.rollout_status) ||
  database.cohort !== 0 || JSON.stringify(database.targets) !==
    JSON.stringify({ explicit_device_ids: [item.deviceId] }) || database.broad_active !== 0 ||
  database.managed_identity !== "ED25519_V1" ||
  database.managed_phase !== "MANAGED_IDENTITY_VERIFIED" || database.fresh_proof !== 1)
  throw new Error("P38_MANAGED_AUTH_ACTIVATION_HOME_QA_INVALID");

const plan = { protocol: "observer-push38-managed-auth-continuity-activation-v1", component,
  generated_at: new Date().toISOString(), release_id: item.releaseId, rollback_release_id: item.rollbackReleaseId,
  current_release_id: current.release_id, current_artifact_sha256: current.artifact_sha256,
  target_artifact_sha256: item.digest, exact_device_id: item.deviceId, cohort_percent: 0,
  trust: "PASS", r2_round_trip: "PASS", rollback: "PASS", service_manager: "PASS",
  component_pid: componentService.pid, ota_agent_pid: agentService.pid,
  current_health_sha256: sha(Buffer.from(JSON.stringify(health))), database };
if (mode === "PREFLIGHT") {
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: "PREFLIGHT_PASS", component, release_id: item.releaseId,
    evidence_sha256: sha(readFileSync(outputPath)), exact_device: true, broad_cohort: false,
    ota_agent_owns_install: true, runtime_writes: 0 }));
  process.exit(0);
}

const savedBytes = protectedFile(planPath), saved = JSON.parse(savedBytes);
if (!/^[a-f0-9]{64}$/.test(planSha) || sha(savedBytes) !== planSha ||
  saved.protocol !== plan.protocol || saved.component !== component ||
  saved.release_id !== item.releaseId || saved.current_release_id !== current.release_id ||
  saved.current_artifact_sha256 !== current.artifact_sha256 ||
  saved.component_pid !== componentService.pid || saved.ota_agent_pid !== agentService.pid ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_MANAGED_AUTH_ACTIVATION_PLAN_INVALID");
const sql = `begin;
update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
where release_id in (select id from public.observer_edge_releases where deployment_profile='${item.profile}')
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
      where r.deployment_profile='${item.profile}' and r.release_id<>'${item.releaseId}' and o.status='ACTIVE')
  then raise exception 'P38_MANAGED_AUTH_ACTIVATION_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, stdio: ["pipe", "pipe", "pipe"] });
const result = { ...plan, activated_at: new Date().toISOString(), exact_rollout_active: true,
  broad_cohort: false, ota_agent_owns_install: true, runtime_writes: 0 };
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ status: "EXACT_MANAGED_AUTH_CONTINUITY_ROLLOUT_ACTIVE", component,
  release_id: item.releaseId, evidence_sha256: sha(readFileSync(outputPath)), exact_device: true,
  broad_cohort: false, ota_agent_owns_install: true, runtime_writes: 0 }));
