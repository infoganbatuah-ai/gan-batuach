// Read-only live-host preflight for the management-agent handoff that precedes
// activation of the Connector liveness-continuity rollout. This verifies the
// existing signed rollback state and never mutates CURRENT, KNOWN_GOOD,
// launchd, the qualification database, or the functional runtime.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { existsSync, lstatSync, readFileSync, realpathSync, statfsSync, statSync,
  writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_CONNECTOR_LIVENESS_CONTINUITY as item
} from "../../services/video-gateway/push38-home-qa-connector-liveness-continuity.mjs";
import { PUSH38_CONNECTOR_RELAY_BACKOFF_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-relay-backoff.mjs";

const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const bundle = resolve(option("bundle") || ".");
const relayBackoff = process.argv.includes("--relay-backoff");
const release = relayBackoff ? PUSH38_CONNECTOR_RELAY_BACKOFF_RECOVERY : item;
const artifact = relayBackoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-relay-backoff-4cc211b8/connector-remediation.tar.gz"
  : "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-liveness-continuity-2840a593/connector-remediation.tar.gz";
const publication = relayBackoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-relay-backoff-4cc211b8/r2-publication.json"
  : "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-liveness-continuity-2840a593/r2-publication.json";
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const configPath = join(root, "agent-config.json");
const agentReleasePath = join(root, "agent", "agent-release.json");
const priorManagement = Object.freeze({
  releaseId: relayBackoff ? "qa-p38-health-connector-liveness-continuity-6efc70f798aa" :
    "qa-p38-management-guard-retry-bc310bf7605c",
  artifactSha256: relayBackoff ?
    "6efc70f798aad884f235ba5637bccf36bc4f1b2d71ada25e5b84e1c6f7b1d9ea" :
    "bc310bf7605cb7a05386c10130bb58c8c3459a65469850cbfc65efc1d48b0f60"
});

if (!process.argv.includes("--dry-run") || outputPath === resolve(".") ||
  !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_PREFLIGHT_MODE_INVALID");

function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_LIVENESS_AGENT_PROTECTED_INPUT_REQUIRED");
  return readFileSync(path);
}
function localProtectedFile(path) {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    realpathSync(path) !== resolve(path) || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_LIVENESS_AGENT_LOCAL_INPUT_UNSAFE");
  return readFileSync(path);
}
function docker(args) {
  return execFileSync("docker", ["--context", "colima-push38t", ...args], {
    encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
function psql(sql) {
  return docker(["exec", "supabase_db_gan-batuach-push38t", "psql", "-X", "-A", "-t",
    "-U", "postgres", "-d", "postgres", "-c", sql]);
}
function service(label) {
  const value = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${label}`], {
    encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"]
  });
  return { running: value.includes("state = running"),
    pid: Number(/\bpid = (\d+)/.exec(value)?.[1] || 0) || null };
}
function tlsProbe(pathname) {
  return new Promise((accept, reject) => {
    const request = httpsRequest({ hostname: "127.0.0.1", port: 3101, path: pathname, method: "GET",
      ca: readFileSync(config.qaTlsCaPath), rejectUnauthorized: true, timeout: 8_000 }, response => {
      response.resume(); response.on("end", () => accept(response.statusCode));
    });
    request.on("timeout", () => request.destroy(new Error("P38_CONNECTOR_LIVENESS_AGENT_TLS_TIMEOUT")));
    request.on("error", reject); request.end();
  });
}
async function runtimeSample() {
  const state = service("com.ganbatuach.software-connector.tapo");
  const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("P38_CONNECTOR_LIVENESS_AGENT_RUNTIME_UNAVAILABLE");
  const health = await response.json();
  return { pid: state.pid, running: state.running, ok: health.ok === true,
    status: health.status || null, expected: health.lastDiscovery?.channelCount ?? null,
    connected: health.lastDiscovery?.connectedCount ?? null,
    progressing: health.mediaHeartbeat?.progressingRelays ?? null,
    stalled: health.mediaHeartbeat?.stalledRelays ?? null,
    reason: health.lastDiscovery?.reason || health.mediaHeartbeat?.relayStates?.[0]?.failureReason || null };
}

for (const path of [bundle, artifact, publication]) protectedFile(path);
const config = JSON.parse(localProtectedFile(configPath));
if (config.profile !== release.profile || config.deviceId !== release.deviceId || config.channel !== "HOME_QA" ||
  config.managedRoot !== root || config.port !== 18083 || !config.qaTlsCaPath ||
  sha(localProtectedFile(config.qaTlsCaPath)) !== config.qaTlsCaSha256)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_CONFIG_INVALID");
const installedAgent = JSON.parse(localProtectedFile(agentReleasePath));
if (installedAgent.release_id !== priorManagement.releaseId ||
  installedAgent.artifact_sha256 !== priorManagement.artifactSha256)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_PRIOR_MISMATCH");

const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle,
  relayBackoff ? "connector_remediation_relay_backoff.json" :
    "connector_remediation_liveness_continuity.json"], {
  encoding: "utf8", timeout: 15_000, maxBuffer: 16_384
}));
const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const publicationProof = JSON.parse(protectedFile(publication));
const expectedObject = `home-qa/${release.releaseId}/${release.digest}.tar.gz`;
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== release.releaseId ||
  manifest.version !== release.version || manifest.build_sha !== release.buildSha ||
  manifest.artifact_sha256 !== release.digest || manifest.artifact_size !== release.size ||
  manifest.profile !== release.profile || manifest.channel !== "HOME_QA" ||
  manifest.signing_key_id !== "observer-kms-release-v1" || manifest.rollout?.cohort_percent !== 0 ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([release.deviceId]) ||
  assertEdgeReleaseObjectUrl(manifest,
    "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com") !== expectedObject ||
  statSync(artifact).size !== release.size || sha(readFileSync(artifact)) !== release.digest ||
  publicationProof.release_id !== release.releaseId || publicationProof.object_key !== expectedObject ||
  publicationProof.artifact_sha256 !== release.digest || publicationProof.bytes !== release.size ||
  publicationProof.round_trip !== "PASS" || publicationProof.anonymous_access_denied !== true)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_RELEASE_INVALID");

const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: release.deviceId, profile: release.profile, platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: release.rollbackVersion, configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
const current = manager.current(), knownGood = manager.knownGood();
if (current.release_id !== release.rollbackReleaseId ||
  !knownGood.some(entry => entry.release_id === release.rollbackReleaseId &&
    entry.artifact_sha256 === current.artifact_sha256) ||
  manager.quarantine().some(entry => entry.release_id === release.releaseId))
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_ROLLBACK_INVALID");
manager.verifySlot(current);

const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}",
  "supabase_db_gan-batuach-push38t"]));
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]);
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" || network !== "127.0.0.1")
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_DATABASE_NOT_ISOLATED");
const rollout = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'releases',(select count(*) from public.observer_edge_releases where channel='HOME_QA'),
  'new_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${release.releaseId}'),
  'new_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${release.releaseId}'),
  'new_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${release.releaseId}'),
  'prior_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${release.supersedesReleaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0),
  'managed_phase',(select metadata->>'home_qa_phase' from public.video_gateway_device_enrollments where gateway_id='${release.deviceId}'),
  'managed_identity',(select identity_scheme from public.video_gateway_device_enrollments where gateway_id='${release.deviceId}'),
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e join public.observer_managed_device_credentials c on c.enrollment_id=e.id and c.credential_version=e.credential_version where e.gateway_id='${release.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered' and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '2 minutes' and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id and n.credential_version=e.credential_version and n.observed_at>=now()-interval '2 minutes')));`));
if (rollout.devices !== 2 || rollout.releases !== (relayBackoff ? 18 : 16) || rollout.new_status !== "DRAFT" ||
  rollout.new_cohort !== 0 ||
  JSON.stringify(rollout.new_targets) !== JSON.stringify({ explicit_device_ids: [release.deviceId] }) ||
  rollout.prior_status !== "PAUSED" || rollout.broad_active !== 0 ||
  rollout.managed_phase !== "MANAGED_IDENTITY_VERIFIED" || rollout.managed_identity !== "ED25519_V1" ||
  rollout.fresh_proof !== 1)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_HOME_QA_INVALID");

const runtime = service("com.ganbatuach.software-connector.tapo");
const agent = service("com.ganbatuach.software-connector.tapo.ota-agent");
if (!runtime.running || !runtime.pid || !agent.running || !agent.pid)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_SERVICE_INVALID");
const samples = [];
for (let index = 0; index < 3; index += 1) {
  samples.push(await runtimeSample());
  if (index < 2) await new Promise(accept => setTimeout(accept, 2_000));
}
if (samples.some(sample => !sample.running || !sample.pid || sample.expected !== 1) ||
  new Set(samples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_RUNTIME_UNSTABLE");
const disk = statfsSync(root);
if (Number(disk.bavail) * Number(disk.bsize) < release.size * 3)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_DISK_INSUFFICIENT");
const [anonymous, wrongRoute] = await Promise.all([
  tlsProbe(`/api/video-gateway/edge-updates?platform=darwin&architecture=arm64&profile=SOFTWARE_CONNECTOR&current_version=${encodeURIComponent(release.rollbackVersion)}&config_version=4&channel=HOME_QA`),
  tlsProbe("/api/video-gateway/not-exposed")
]);
if (anonymous !== 401 || wrongRoute !== 404)
  throw new Error("P38_CONNECTOR_LIVENESS_AGENT_INGRESS_INVALID");

const evidence = { protocol: relayBackoff ? "observer-push38-connector-relay-backoff-agent-preflight-v1" :
    "observer-push38-connector-liveness-agent-preflight-v1",
  generated_at: new Date().toISOString(), result: "PASS", runtime_writes: 0,
  release_id: release.releaseId, exact_device_id: release.deviceId, broad_cohort: false,
  signed_manifest: "PASS", live_trust: "PASS", private_r2_round_trip: "PASS",
  prior_management_release: priorManagement.releaseId,
  current_release: current.release_id, rollback_target: release.rollbackReleaseId,
  rollback_slot: "VERIFIED", managed_device_fresh_proof: "PASS", https_control: "PASS",
  service_manager: "PASS", runtime_pid: runtime.pid, ota_agent_pid: agent.pid,
  runtime_samples: samples, disk: "PASS", functional_runtime_writes: 0 };
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "LIVENESS_AGENT_PREFLIGHT_PASS", release_id: release.releaseId,
  evidence_sha256: sha(readFileSync(outputPath)), rollback: "PASS", trust: "PASS",
  home_qa: "PASS", authorization: "PASS", runtime_writes: 0 }));
