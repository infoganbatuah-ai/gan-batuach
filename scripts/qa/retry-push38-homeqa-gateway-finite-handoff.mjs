// Authorize one exact retry of the quarantined finite-stream Gateway release
// after the signed known-good recovered 8/8 real DVR media. The installed OTA
// agent remains the only installer and rollback owner.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const DEVICE_ID = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const RELEASE_ID = "qa-p38-health-gateway-finite-handoff-76781a8e0832";
const VERSION = "0.2.13-p38-health";
const DIGEST = "76781a8e08328feb154525451c5c4a26aaca43739279f9a052280758d1a02ffb";
const FAILURE = "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED";
const CURRENT_RELEASE = "qa-p38-health-gateway-session-e354546bdbf8";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" : process.argv.includes("--apply") ? "APPLY" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode || !outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_FINITE_RETRY_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(RESTRICTED_ROOT) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_FINITE_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
    const response = await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(8_000) });
    const body = await response.json();
    const sample = { http: response.status, ok: body.ok === true, status: body.status || null,
      assigned: body.lastDiscovery?.assignedCount ?? null,
      connected: body.lastDiscovery?.connectedCount ?? null,
      failed: body.lastDiscovery?.failedAssignedCount ?? null,
      empty: body.lastDiscovery?.unassignedCount ?? null,
      progressing: body.mediaHeartbeat?.progressingRelays ?? null,
      stalled: body.mediaHeartbeat?.stalledRelays ?? null,
      rotations: body.recorderSessionLifecycle?.rotations ?? null };
    samples.push(sample);
    if (sample.http !== 200 || sample.ok || sample.status !== "degraded" ||
      sample.assigned !== 10 || sample.connected !== 8 || sample.failed !== 2 || sample.empty !== 6 ||
      sample.progressing !== 8 || sample.stalled !== 0)
      throw new Error("P38_GATEWAY_FINITE_RETRY_KNOWN_GOOD_NOT_RECOVERED");
    if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 3_000));
  }
  return samples;
}

const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root: ROOT, trustedPublicKeys: trusted,
  device: { deviceId: DEVICE_ID, profile: "PHYSICAL_GATEWAY", platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: "0.2.11-p38-health",
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const manifestPath = join(ROOT, "slots", VERSION, "release.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const verified = verifyEdgeUpdateManifest(manifest, trusted);
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (!verified.ok || manifest.release_id !== RELEASE_ID || manifest.artifact_sha256 !== DIGEST ||
  current.release_id !== CURRENT_RELEASE || !knownGood.some(item =>
    item.release_id === CURRENT_RELEASE && item.artifact_sha256 === current.artifact_sha256) ||
  state.state !== "ROLLED_BACK" || state.release_id !== RELEASE_ID ||
  state.failure_category !== FAILURE || !manager.quarantine().some(item =>
    item.release_id === RELEASE_ID && item.reason === FAILURE))
  throw new Error("P38_GATEWAY_FINITE_RETRY_SIGNED_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);
manager.verifySlot({ version: VERSION, slot: join(ROOT, "slots", VERSION),
  release_id: RELEASE_ID, artifact_sha256: DIGEST });

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'status',o.status,'cohort_percent',o.cohort_percent,'target_filters',o.target_filters,
  'profile',r.deployment_profile,'platform',r.platform,'architecture',r.architecture,
  'channel',r.channel,'release_state',r.release_state,'artifact_sha256',r.artifact_sha256,
  'signing_key_id',r.signing_key_id)::text
from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
where r.release_id='${RELEASE_ID}'`));
if (rollout.status !== "ACTIVE" || rollout.cohort_percent !== 0 || rollout.profile !== "PHYSICAL_GATEWAY" ||
  rollout.platform !== "darwin" || rollout.architecture !== "arm64" || rollout.channel !== "HOME_QA" ||
  rollout.release_state !== "PUBLISHED" || rollout.artifact_sha256 !== DIGEST ||
  JSON.stringify(rollout.target_filters) !== JSON.stringify({ explicit_device_ids: [DEVICE_ID] }) ||
  Number(psql("select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0")) !== 0)
  throw new Error("P38_GATEWAY_FINITE_RETRY_ROLLOUT_STATE_INVALID");

const healthSamples = await stableRecoveredHealth();
const plan = { protocol: "observer-push38-gateway-finite-handoff-retry-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: RELEASE_ID,
  version: VERSION, artifact_sha256: DIGEST, exact_device_id: DEVICE_ID,
  prior_failure: FAILURE, current_release_id: CURRENT_RELEASE,
  known_good_recovery: "8_OF_8_PROGRESSING", health_samples: healthSamples,
  retry_health_driver: "AUTHORIZED_LOOPBACK_PLAYBACK_ONLY", signed_manifest: "PASS",
  live_trust: "PASS", broad_cohort: false, runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "GATEWAY_FINITE_RETRY_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, exact_device: true, broad_cohort: false, runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256) || sha(planBytes) !== planSha256)
  throw new Error("P38_GATEWAY_FINITE_RETRY_PLAN_PIN_MISMATCH");
const saved = JSON.parse(planBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== RELEASE_ID ||
  saved.artifact_sha256 !== DIGEST || Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_GATEWAY_FINITE_RETRY_PLAN_STALE");
let authorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: planSha256 });
  authorized = true;
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(), authorization,
    failed_slot_removed: !existsSync(join(ROOT, "slots", VERSION)), exact_rollout_active: true,
    ota_agent_owns_install: true, functional_runtime_changed_by_command: false, runtime_writes: 0 };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_GATEWAY_FINITE_RETRY_AUTHORIZED",
    evidence_sha256: evidenceSha, failed_slot_removed: true, exact_rollout_active: true,
    broad_cohort: false, ota_agent_owns_install: true }));
} catch (error) {
  if (authorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
