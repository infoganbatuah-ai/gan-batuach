// Authorize one exact retry of the quarantined PUSH 38 Connector remediation
// only after the external camera endpoint was independently reconciled and a
// fresh 1/1 health proof exists. The normal OTA agent still performs download,
// verification, install, health promotion, and rollback.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const DEVICE_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const SOURCE_ID = "7465c0f2-ba57-4299-b22e-f20cedb91c23";
const RELEASE_ID = "qa-p38-health-connector-startup-d44b7e4262f9";
const VERSION = "0.2.12-p38-health";
const FAILURE = "EDGE_UPDATE_CAMERA_PROGRESSION_FAILED";
const CURRENT_RELEASE = "qa-connector-legacy-transition-v2-6e7988808b05";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const SECRET_DIR = join(homedir(), "Library/Application Support/Digital Observer/Tapo Connector/secrets");
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "preflight" : process.argv.includes("--apply") ? "apply" : "";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const endpointEvidencePath = resolve(option("endpoint-evidence") || ".");
const endpointEvidenceSha256 = option("endpoint-evidence-sha256");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha256 = option("plan-sha256");
if (!mode) throw new Error("P38_CONNECTOR_RETRY_MODE_REQUIRED");
if (!outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath)) {
  throw new Error("P38_CONNECTOR_RETRY_RESTRICTED_NEW_OUTPUT_REQUIRED");
}

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function endpointHost(value) {
  const raw = String(value || "").trim();
  try { return new URL(raw.includes("://") ? raw : `rtsp://${raw}`).hostname; }
  catch { throw new Error("P38_CONNECTOR_RETRY_ENDPOINT_INVALID"); }
}
function protectedFile(path) {
  if (!path || !realpathSync(path).startsWith(RESTRICTED_ROOT) || lstatSync(path).isSymbolicLink()
    || (statSync(path).mode & 0o077) !== 0) throw new Error("P38_CONNECTOR_RETRY_PROTECTED_EVIDENCE_REQUIRED");
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
async function health() {
  const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("P38_CONNECTOR_RETRY_HEALTH_UNAVAILABLE");
  const body = await response.json();
  return { ok: body.ok === true, status: body.status || null,
    assigned: body.lastDiscovery?.assignedCount ?? body.lastDiscovery?.channelCount ?? null,
    connected: body.lastDiscovery?.connectedCount ?? null,
    progressing: body.mediaHeartbeat?.progressingRelays ?? null,
    stalled: body.mediaHeartbeat?.stalledRelays ?? null,
    checked_at: body.lastDiscovery?.checkedAt || null };
}
async function stableHealth() {
  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    const sample = await health();
    samples.push(sample);
    if (!sample.ok || sample.assigned !== 1 || sample.connected !== 1 ||
      sample.progressing !== 1 || sample.stalled !== 0) throw new Error("P38_CONNECTOR_RETRY_TAPO_NOT_STABLE");
    if (index < 2) await new Promise((resolveWait) => setTimeout(resolveWait, 3000));
  }
  return samples;
}

const endpointBytes = protectedFile(endpointEvidencePath);
if (!/^[a-f0-9]{64}$/.test(endpointEvidenceSha256) || sha(endpointBytes) !== endpointEvidenceSha256) {
  throw new Error("P38_CONNECTOR_RETRY_ENDPOINT_EVIDENCE_PIN_MISMATCH");
}
const endpointEvidence = JSON.parse(endpointBytes);
if (endpointEvidence.protocol !== "observer-push38-live-tapo-endpoint-reconciliation-v1" ||
  endpointEvidence.mode !== "APPLY" || endpointEvidence.public_identity !== "UNIQUE_ONVIF_C211" ||
  endpointEvidence.source_id_preserved !== true || endpointEvidence.endpoint_only_change !== true ||
  endpointEvidence.credentials_changed !== false || endpointEvidence.health_after?.discovery?.connected !== 1 ||
  endpointEvidence.health_after?.media?.progressing !== 1 || endpointEvidence.health_after?.media?.stalled !== 0 ||
  Date.now() - Date.parse(endpointEvidence.observed_at) > 60 * 60_000) {
  throw new Error("P38_CONNECTOR_RETRY_ENDPOINT_EVIDENCE_INVALID");
}
const secretStore = createEdgeSecretStoreSync({ secretDir: SECRET_DIR });
const installedProfiles = JSON.parse(secretStore.read("connector_profiles_json"));
if (!Array.isArray(installedProfiles) || installedProfiles.length !== 1 ||
  installedProfiles[0]?.camera_source_id !== SOURCE_ID ||
  sha(endpointHost(installedProfiles[0].endpoint)) !== endpointEvidence.endpoint_after_hash) {
  throw new Error("P38_CONNECTOR_RETRY_SOURCE_BINDING_CHANGED");
}
const trustedPublicKeys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const manager = new EdgeUpdateManager({ root: ROOT, trustedPublicKeys,
  device: { deviceId: DEVICE_ID, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 4, revoked: false },
  adapter: {}, healthCheck: async () => ({}) });
const manifestPath = join(ROOT, "slots", VERSION, "release.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const verification = verifyEdgeUpdateManifest(manifest, trustedPublicKeys);
if (!verification.ok || manifest.release_id !== RELEASE_ID || manifest.version !== VERSION ||
  manager.current().release_id !== CURRENT_RELEASE || manager.knownGood().at(-1)?.release_id !== CURRENT_RELEASE ||
  manager.status().state !== "ROLLED_BACK" || manager.status().release_id !== RELEASE_ID ||
  manager.status().failure_category !== FAILURE ||
  !manager.quarantine().some((item) => item.release_id === RELEASE_ID && item.reason === FAILURE)) {
  throw new Error("P38_CONNECTOR_RETRY_SIGNED_ROLLBACK_STATE_INVALID");
}
const rollout = JSON.parse(psql(`select jsonb_build_object(
  'status',o.status,'cohort_percent',o.cohort_percent,'paused_reason',o.paused_reason,
  'target_filters',o.target_filters,'profile',r.deployment_profile,'platform',r.platform,
  'architecture',r.architecture,'channel',r.channel,'release_state',r.release_state,
  'artifact_sha256',r.artifact_sha256,'signing_key_id',r.signing_key_id)::text
  from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
  where r.release_id='${RELEASE_ID}'`));
if (rollout.status !== "PAUSED" || rollout.paused_reason !== "P38_QA_DIAGNOSTIC_HOLD" ||
  rollout.cohort_percent !== 0 || rollout.channel !== "HOME_QA" || rollout.profile !== "SOFTWARE_CONNECTOR" ||
  rollout.platform !== "darwin" || rollout.architecture !== "arm64" || rollout.release_state !== "PUBLISHED" ||
  rollout.artifact_sha256 !== manifest.artifact_sha256 || rollout.signing_key_id !== manifest.signing_key_id ||
  JSON.stringify(rollout.target_filters) !== JSON.stringify({ explicit_device_ids: [DEVICE_ID] }) ||
  Number(psql("select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent>0")) !== 0) {
  throw new Error("P38_CONNECTOR_RETRY_ROLLOUT_STATE_INVALID");
}
const samples = await stableHealth();
const plan = { protocol: "observer-push38-quarantined-release-retry-v1", generated_at: new Date().toISOString(),
  release_id: RELEASE_ID, version: VERSION, prior_failure: FAILURE, current_release_id: CURRENT_RELEASE,
  endpoint_evidence_sha256: endpointEvidenceSha256, public_camera_identity: "UNIQUE_ONVIF_C211",
  exact_device_id: DEVICE_ID, exact_source_id: SOURCE_ID, cohort_percent: 0,
  health_samples: samples, signed_manifest: "PASS", live_trust: "PASS", runtime_writes: 0 };

if (mode === "preflight") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: "RETRY_PREFLIGHT_PASS", evidence_sha256: evidenceSha,
    release_id: RELEASE_ID, exact_device: true, broad_cohort: false, tapo: "1/1", runtime_writes: 0 }));
  process.exit(0);
}

const planBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha256) || sha(planBytes) !== planSha256) {
  throw new Error("P38_CONNECTOR_RETRY_PLAN_PIN_MISMATCH");
}
const savedPlan = JSON.parse(planBytes);
if (savedPlan.protocol !== plan.protocol || savedPlan.release_id !== RELEASE_ID ||
  savedPlan.endpoint_evidence_sha256 !== endpointEvidenceSha256 ||
  Date.now() - Date.parse(savedPlan.generated_at) > 10 * 60_000) {
  throw new Error("P38_CONNECTOR_RETRY_PLAN_STALE");
}
let retryAuthorized = false;
try {
  const authorization = manager.authorizeQuarantinedReleaseRetry({ manifest,
    expectedFailureCategory: FAILURE, remediationEvidenceSha256: endpointEvidenceSha256 });
  retryAuthorized = true;
  const activated = Number(psql(`with updated as (
    update public.observer_edge_rollouts o set status='ACTIVE',paused_reason=null,updated_at=now()
    from public.observer_edge_releases r where o.release_id=r.id and r.release_id='${RELEASE_ID}'
      and o.status='PAUSED' and o.paused_reason='P38_QA_DIAGNOSTIC_HOLD' and o.cohort_percent=0
      and o.target_filters='{"explicit_device_ids":["${DEVICE_ID}"]}'::jsonb returning o.id)
    select count(*) from updated`));
  if (activated !== 1 || Number(psql("select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent>0")) !== 0) {
    throw new Error("P38_CONNECTOR_RETRY_ROLLOUT_ACTIVATION_FAILED");
  }
  const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(),
    authorization, failed_slot_removed: true, exact_rollout_active: true,
    other_quarantined_releases_preserved: manager.quarantine().length === 2,
    runtime_writes: 0, ota_agent_owns_install: true };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "EXACT_RETRY_AUTHORIZED", evidence_sha256: evidenceSha,
    release_id: RELEASE_ID, failed_slot_removed: true, exact_rollout_active: true,
    broad_cohort: false, ota_agent_owns_install: true }));
} catch (error) {
  if (retryAuthorized) manager.quarantineRelease(manifest, FAILURE);
  throw error;
}
