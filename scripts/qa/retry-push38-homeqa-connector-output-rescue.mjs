// Authorize one exact retry of the signed Connector output-rescue release.
// The release had already remained healthy for hours before a host-wide
// supervision incident coincident with the failed Gateway activation. The
// normal OTA agent remains the only installer, health-gate and rollback owner.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const DEVICE_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const RELEASE_ID = "qa-p38-health-connector-output-rescue-b0b6ef01b6e1";
const VERSION = "0.2.27-p38-health";
const DIGEST = "b0b6ef01b6e100b623ab68aa291ed5e4ab0e37edcf5b91e83777c43648549b08";
const FAILURE = "EDGE_UPDATE_CRASH_LOOP";
const CURRENT_RELEASE = "qa-p38-health-connector-rtsp-cadence-559bb01f78a2";
const CURRENT_VERSION = "0.2.26-p38-health";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const AGENT_LOG = join(ROOT, "agent.out.log");
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" : process.argv.includes("--apply") ? "APPLY" : "";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || !outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath))
  throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(RESTRICTED_ROOT) ||
    lstatSync(path).isSymbolicLink() || !statSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function psql(sql) {
  return execFileSync("docker", ["--context", "colima-push38t", "exec",
    "supabase_db_gan-batuach-push38t", "psql", "-X", "-A", "-t", "-U", "postgres",
    "-d", "postgres", "-c", sql], { encoding: "utf8", timeout: 45_000,
    stdio: ["ignore", "pipe", "pipe"] }).trim();
}
async function stableRecoveredHealth() {
  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(15_000) });
    const body = await response.json();
    const sample = { http: response.status, ok: body.ok === true, status: body.status || null,
      assigned: body.lastDiscovery?.assignedCount ?? body.lastDiscovery?.channelCount ?? null,
      connected: body.lastDiscovery?.connectedCount ?? null,
      progressing: body.mediaHeartbeat?.progressingRelays ?? null,
      stalled: body.mediaHeartbeat?.stalledRelays ?? null,
      checked_at: body.lastDiscovery?.checkedAt || null };
    samples.push(sample);
    if (sample.http !== 200 || !sample.ok || sample.status !== "healthy" || sample.assigned !== 1 ||
      sample.connected !== 1 || sample.progressing !== 1 || sample.stalled !== 0)
      throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_KNOWN_GOOD_NOT_HEALTHY");
    if (index < 2) await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
  }
  return samples;
}
function priorHealthyWindow(state) {
  const observations = [];
  for (const line of readFileSync(AGENT_LOG, "utf8").split("\n")) {
    if (!line.includes(RELEASE_ID) || !line.includes('"state":"HEALTHY"')) continue;
    try {
      const item = JSON.parse(line);
      if (item.release_id === RELEASE_ID && item.state === "HEALTHY" && Number.isFinite(Date.parse(item.at)))
        observations.push(item.at);
    } catch { /* bounded JSON-line evidence; unrelated text is ignored */ }
  }
  if (observations.length < 100) throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_PRIOR_HEALTH_EVIDENCE_INSUFFICIENT");
  const first = observations[0], last = observations.at(-1);
  const durationMs = Date.parse(last) - Date.parse(first);
  const rollback = (state.history || []).filter((item) => item.state === "ROLLBACK_REQUIRED" &&
    item.category === FAILURE && Number.isFinite(Date.parse(item.at))).at(-1);
  const failureGapMs = Date.parse(rollback?.at || "") - Date.parse(last);
  if (durationMs < 7 * 60 * 60_000 || !rollback || failureGapMs < 0 || failureGapMs > 15 * 60_000)
    throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_PRIOR_HEALTH_TIMELINE_INVALID");
  return { first_healthy_at: first, last_healthy_at: last, healthy_observations: observations.length,
    observed_healthy_duration_ms: durationMs, rollback_required_at: rollback.at,
    last_health_to_rollback_ms: failureGapMs };
}

const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root: ROOT, trustedPublicKeys: trusted,
  device: { deviceId: DEVICE_ID, profile: "SOFTWARE_CONNECTOR", platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: CURRENT_VERSION,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifestPath = join(ROOT, "slots", VERSION, "release.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (!verified.ok || manifest.release_id !== RELEASE_ID || manifest.version !== VERSION ||
  manifest.artifact_sha256 !== DIGEST || current.release_id !== CURRENT_RELEASE ||
  current.version !== CURRENT_VERSION || !knownGood.some((item) => item.release_id === CURRENT_RELEASE &&
    item.artifact_sha256 === current.artifact_sha256) || state.state !== "ROLLED_BACK" ||
  state.release_id !== RELEASE_ID || ![FAILURE, "EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY"].includes(state.failure_category) ||
  !(state.history || []).some((item) => item.state === "ROLLBACK_REQUIRED" && item.category === FAILURE) ||
  !manager.quarantine().some((item) => item.release_id === RELEASE_ID && item.reason === FAILURE) ||
  manager.readJson(manager.quarantineRetryPath, []).some((item) => item.release_id === RELEASE_ID))
  throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_SIGNED_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: VERSION, slot: join(ROOT, "slots", VERSION), release_id: RELEASE_ID,
  artifact_sha256: DIGEST });

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'status',o.status,'cohort_percent',o.cohort_percent,'target_filters',o.target_filters,
  'profile',r.deployment_profile,'platform',r.platform,'architecture',r.architecture,
  'channel',r.channel,'release_state',r.release_state,'artifact_sha256',r.artifact_sha256,
  'signing_key_id',r.signing_key_id)::text
from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
where r.release_id='${RELEASE_ID}'`));
if (rollout.status !== "ACTIVE" || rollout.cohort_percent !== 0 || rollout.profile !== "SOFTWARE_CONNECTOR" ||
  rollout.platform !== "darwin" || rollout.architecture !== "arm64" || rollout.channel !== "HOME_QA" ||
  rollout.release_state !== "PUBLISHED" || rollout.artifact_sha256 !== DIGEST ||
  rollout.signing_key_id !== manifest.signing_key_id ||
  JSON.stringify(rollout.target_filters) !== JSON.stringify({ explicit_device_ids: [DEVICE_ID] }) ||
  Number(psql("select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0")) !== 0)
  throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_ROLLOUT_STATE_INVALID");

const priorHealth = priorHealthyWindow(state);
const healthSamples = await stableRecoveredHealth();
const plan = { protocol: "observer-push38-connector-output-rescue-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: RELEASE_ID,
  version: VERSION, artifact_sha256: DIGEST, exact_device_id: DEVICE_ID,
  prior_failure: FAILURE, recovery_failure: state.failure_category,
  current_release_id: CURRENT_RELEASE, rollback_release_id: CURRENT_RELEASE,
  prior_health: priorHealth, current_health_samples: healthSamples,
  failure_context: "COINCIDENT_HOST_SUPERVISION_WINDOW_WITH_GATEWAY_ACTIVATION",
  retry_scope: "ONE_EXACT_SIGNED_RELEASE", signed_manifest: "PASS", live_trust: "PASS",
  exact_rollout_active: true, broad_cohort: false, runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "CONNECTOR_OUTPUT_RESCUE_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, prior_healthy_hours: priorHealth.observed_healthy_duration_ms / 3_600_000,
    current_health: "1/1", exact_device: true, broad_cohort: false, runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256) || sha(planBytes) !== planSha256)
  throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== RELEASE_ID ||
  saved.artifact_sha256 !== DIGEST || saved.current_release_id !== CURRENT_RELEASE ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_CONNECTOR_OUTPUT_RESCUE_RETRY_PLAN_STALE");
let authorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
  authorized = true;
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(ROOT, "slots", VERSION)), exact_rollout_active: true,
    ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_CONNECTOR_OUTPUT_RESCUE_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, failed_slot_removed: true, exact_rollout_active: true,
    broad_cohort: false, ota_agent_owns_install: true }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
