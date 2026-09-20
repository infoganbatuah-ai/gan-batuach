// Actual Home-host dry run. Never instantiates a mutable OTA manager or changes
// launchd, CURRENT, KNOWN_GOOD, cameras, or Product identities.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statfsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

if (!process.argv.includes("--dry-run") || process.argv.some(value => value === "--apply" || value === "--live"))
  throw new Error("P38_HOME_QA_DRY_RUN_ONLY_UNTIL_PREWRITE_GATES_PASS");
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const identityPath = option("identity"), identitySha = option("sha256"), stagingPath = option("staging");
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
if (!identityPath || !stagingPath || !/^[a-f0-9]{64}$/.test(identitySha || "") ||
  ![identityPath, stagingPath].every(value => realpathSync(resolve(value)).startsWith(restricted)))
  throw new Error("P38_HOME_QA_PINNED_RESTRICTED_EVIDENCE_REQUIRED");
const identityBytes = readFileSync(identityPath);
if (createHash("sha256").update(identityBytes).digest("hex") !== identitySha)
  throw new Error("P38_HOME_QA_IDENTITY_EVIDENCE_CHANGED");
const identity = JSON.parse(identityBytes.toString("utf8"));
const staging = JSON.parse(readFileSync(stagingPath, "utf8"));

const root = "/Volumes/DIGITAL_OBSERVER/QA-Releases";
const run = (file, args, timeout = 120_000) => execFileSync(file, args, {
  encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });
const baseline = JSON.parse(run(process.execPath, ["scripts/qa/check-push38l-live-dry-run.mjs",
  `${root}/PUSH-38F`, `${root}/PUSH-38J/signed`,
  `${root}/PUSH-38L/qa-connector-legacy-transition-v2-6e7988808b05`,
  `${root}/PUSH-38L/live-binding-v2/derivation.json`]));
const trust = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH });
const bundle = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-signed-manifests-35482295860.zip";
const releases = JSON.parse(run(process.execPath, ["scripts/qa/register-push38-homeqa-releases.mjs",
  `--bundle=${bundle}`], 60_000));
const raw = run("docker", ["--context", "colima-push38t", "exec", "supabase_db_gan-batuach-push38t",
  "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c",
  "select (select count(*) from public.video_gateway_device_enrollments where status='pending' and identity_scheme='LEGACY_HMAC' and credential_version=0 and metadata->>'home_qa_phase'='LEGACY_VERIFIED_FOR_TRANSITION')," +
  "(select count(*) from public.observer_edge_releases where channel='HOME_QA')," +
  "(select count(*) from public.observer_edge_rollouts where status='ACTIVE')," +
  "(select count(*) from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='qa-p38-health-connector-1b076f596574' and o.status='DRAFT')," +
  "(select count(distinct e.gateway_id) from public.observer_edge_release_download_authorizations a join public.video_gateway_device_enrollments e on e.id=a.enrollment_id join public.observer_edge_releases r on r.id=a.release_id where a.outcome='ISSUED' and ((e.gateway_id='db267b52-6282-4944-bcee-5d4857698fb0' and r.release_id='qa-connector-legacy-transition-v2-6e7988808b05') or (e.gateway_id='62df97e2-3c0b-427f-9108-bde029bc10e7' and r.release_id='qa-p38-health-gateway-6c9d08327ec6')));"]).trim();
const [devices, registered, active, remediationDraft, authorizedDevices] = raw.split("|").map(Number);
const connectorDevice = readFileSync(join(homedir(),
  "Library/Application Support/Digital Observer/Tapo Connector/secrets/device_gateway_id"), "utf8").trim();
const connectorSite = readFileSync(join(homedir(),
  "Library/Application Support/Digital Observer/Tapo Connector/secrets/device_observer_site_id"), "utf8").trim();
const disk = statfsSync(join(homedir(), "Library/Application Support/Digital Observer"));
const freeBytes = Number(disk.bavail) * Number(disk.bsize);
async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`P38_HOME_QA_HEALTH_HTTP_${port}_${response.status}`);
  const data = await response.json();
  return { ok: data.ok === true, status: data.status,
    progressing: data.mediaHeartbeat?.progressingRelays ?? null,
    stalled: data.mediaHeartbeat?.stalledRelays ?? null,
    emptySlots: port === 18082 ? data.lastDiscovery?.unassignedCount ?? null : null };
}
const [gatewayHealth, connectorHealth] = await Promise.all([health(18082), health(18083)]);
const gates = {
  baseline: baseline.status === "PASS" && baseline.legacy_exact_match && baseline.gateway_baseline_still_matches,
  trust: Boolean(trust.trustedPublicKeys["observer-kms-release-v1"] &&
    trust.trustedPublicKeys["qa-p38f-ed25519-20260913"]),
  signed_artifacts: releases.status === "VERIFIED_NOT_REGISTERED" && releases.artifact_hashes,
  rollback: baseline.status === "PASS" && baseline.managed_layout_conflicts === 0,
  service_manager: baseline.service_running === true,
  disk: freeBytes > 1_000_000_000,
  local_legacy_binding: connectorDevice === "db267b52-6282-4944-bcee-5d4857698fb0" &&
    connectorSite === "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
  qa_devices: devices === 2,
  qa_releases: registered === 3,
  qa_exact_active_rollouts: active === 2 && remediationDraft === 1,
  device_download_authorization: authorizedDevices === 2,
  identity_source_snapshot: identity.protocol === "observer-push38-home-identity-reconciliation-v1" &&
    identity.devices?.length === 2 && identity.dvr?.assigned?.length === 10 &&
    identity.dvr?.empty?.length === 6 && identity.tapo?.installed_source_match === true &&
    Date.now() - Date.parse(identity.observed_at) < 60 * 60_000,
  staged_artifacts: staging.protocol === "observer-push38-homeqa-legacy-staging-v1" &&
    staging.identity_evidence_sha256 === identitySha && staging.results?.length === 2 &&
    staging.results.every(item => item.manifest_signature === "PASS" &&
      item.private_r2 === "PASS" && item.install_authorized === false),
  live_orchestrator: false,
  gateway_health: gatewayHealth.ok && gatewayHealth.progressing === 10 && gatewayHealth.emptySlots === 6,
  connector_process: connectorHealth.ok,
  tapo_progressing: connectorHealth.progressing === 1
};
// Legacy Tapo 0/1 is recorded but not a gate for remediation deployment.
const mandatory = Object.entries(gates).filter(([name]) => name !== "tapo_progressing");
const plan = { protocol: "observer-push38-home-qa-live-plan-v1", generated_at: new Date().toISOString(),
  mode: "DRY_RUN", runtime_writes: 0, prewrite_pass: mandatory.every(([, pass]) => pass === true),
  gates, qa_counts: { devices, registered_releases: registered, active_rollouts: active,
    remediation_draft: remediationDraft, authorized_devices: authorizedDevices },
  home: { gateway: gatewayHealth, connector: connectorHealth },
  component: "SOFTWARE_CONNECTOR", current_state: "LEGACY_UNMANAGED",
  intended_release: "qa-connector-legacy-transition-v2-6e7988808b05",
  artifact_sha256: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a",
  rollback_target: "LEGACY_RECOVERY_ONLY:ee82c20a77acb7fd8caf692682569ad53581e9c057b11724845c6d947c5a982a",
  service_action: "launchd:com.ganbatuach.software-connector.tapo",
  health_gates: ["process", "signed-slot", "same-device", "same-site", "Tapo-observed"],
  promotion_target: "SIGNED_TRANSITION_CURRENT_AND_KNOWN_GOOD",
  failure_recovery: "RESTORE_EXACT_LEGACY_RECOVERY_ONLY_AND_ACTION_REQUIRED",
  next_action: mandatory.every(([, pass]) => pass === true) ? "ELIGIBLE_FOR_REVIEWED_LIVE_ORCHESTRATOR" :
    "HOLD_RUNTIME_UNTIL_FAILED_GATES_CLOSE" };
console.log(JSON.stringify(plan));
if (!plan.prewrite_pass) process.exitCode = 2;
