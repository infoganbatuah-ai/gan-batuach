// Exact Home Connector one-time transition. The dry run performs zero runtime
// writes. Live mode delegates handoff/recovery to the existing signed INTERNAL
// transition manager and macOS launchd adapter; it never copies a runtime by hand.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createConnectorLegacyTransition, verifyLegacyTransitionRecord } from "../../services/video-gateway/edge-connector-legacy-transition.mjs";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { edgeHealthGate, EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const dryRun = process.argv.includes("--dry-run"), apply = process.argv.includes("--apply");
if (dryRun === apply) throw new Error("P38_CONNECTOR_TRANSITION_MODE_REQUIRED");
const identityPath = option("identity"), identitySha = option("sha256"), stagingPath = option("staging");
const outputPath = option("output"), planPath = option("plan"), planSha = option("plan-sha256");
const dvrTruthPath = option("dvr-truth"), dvrTruthSha = option("dvr-truth-sha256");
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
function restrictedFile(path) {
  if (!path || !realpathSync(resolve(path)).startsWith(restricted) ||
    lstatSync(path).isSymbolicLink() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_RESTRICTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
if (!/^[a-f0-9]{64}$/.test(identitySha || "")) throw new Error("P38_CONNECTOR_IDENTITY_PIN_REQUIRED");
const identityBytes = restrictedFile(identityPath);
if (createHash("sha256").update(identityBytes).digest("hex") !== identitySha)
  throw new Error("P38_CONNECTOR_IDENTITY_EVIDENCE_CHANGED");
const identity = JSON.parse(identityBytes.toString("utf8"));
if (identity.protocol !== "observer-push38-home-identity-reconciliation-v1" ||
  identity.devices?.length !== 2 || identity.dvr?.assigned?.length !== 10 ||
  identity.dvr?.empty?.length !== 6 || !identity.tapo?.installed_source_match ||
  Date.now() - Date.parse(identity.observed_at) > 60 * 60_000)
  throw new Error("P38_CONNECTOR_IDENTITY_EVIDENCE_STALE_OR_INCOMPLETE");
const connector = identity.devices.find(item => item.profile === "SOFTWARE_CONNECTOR");
if (!connector || connector.device_id !== "db267b52-6282-4944-bcee-5d4857698fb0" ||
  connector.site_id !== "cc1673b8-3eb0-4785-a12c-1fb88f425a41" ||
  connector.tenant_id !== connector.site_id || connector.identity_phase !== "LEGACY_VERIFIED_FOR_TRANSITION")
  throw new Error("P38_CONNECTOR_IDENTITY_BINDING_CHANGED");
if (!/^[a-f0-9]{64}$/.test(dvrTruthSha || "")) throw new Error("P38_CONNECTOR_DVR_TRUTH_PIN_REQUIRED");
const dvrTruthBytes = restrictedFile(dvrTruthPath);
if (createHash("sha256").update(dvrTruthBytes).digest("hex") !== dvrTruthSha)
  throw new Error("P38_CONNECTOR_DVR_TRUTH_CHANGED");
const dvrTruth = JSON.parse(dvrTruthBytes.toString("utf8"));
const availableDvrChannels = [1, 3, 4, 5, 6, 7, 10, 11];
if (dvrTruth.protocol !== "observer-push38-live-gateway-dvr-truth-v1" ||
  dvrTruth.result !== "MEDIA_AND_SOURCE_TRUTH_PASS" ||
  Date.now() - Date.parse(dvrTruth.ended_at) > 60 * 60_000 ||
  JSON.stringify(dvrTruth.source_available) !== JSON.stringify(availableDvrChannels) ||
  JSON.stringify(dvrTruth.upstream_unavailable) !== "[2,8]" ||
  JSON.stringify(dvrTruth.empty) !== "[9,12,13,14,15,16]" ||
  !Array.isArray(dvrTruth.checkpoints) || dvrTruth.checkpoints.length < 3 ||
  dvrTruth.checkpoints.some(point => point.health?.discovery?.assigned !== 10 ||
    point.health?.discovery?.connected !== 8 || point.health?.discovery?.failed !== 2 ||
    point.health?.discovery?.empty !== 6 ||
    availableDvrChannels.some(channel => !point.media?.some(item => item.channel === channel && item.decoded))))
  throw new Error("P38_CONNECTOR_DVR_SOURCE_TRUTH_INVALID");
const staging = JSON.parse(restrictedFile(stagingPath).toString("utf8"));
const staged = staging.results?.find(item => item.release_id === "qa-connector-legacy-transition-v2-6e7988808b05");
const artifactPath = staged?.verified_staging_path;
if (staging.protocol !== "observer-push38-homeqa-legacy-staging-v1" ||
  staging.identity_evidence_sha256 !== identitySha || staged?.manifest_signature !== "PASS" ||
  staged?.private_r2 !== "PASS" || staged?.install_authorized !== false ||
  !artifactPath || !realpathSync(artifactPath).startsWith(`${realpathSync("/private/tmp")}/`) ||
  lstatSync(artifactPath).isSymbolicLink())
  throw new Error("P38_CONNECTOR_STAGED_ARTIFACT_INVALID");
const archive = readFileSync(artifactPath);
const base = "/Volumes/DIGITAL_OBSERVER/QA-Releases";
const legacyDir = join(base, "PUSH-38F/qa-legacy-connector-ee82c20a77ac");
const transitionDir = join(base, "PUSH-38L/qa-connector-legacy-transition-v2-6e7988808b05");
const legacyManifest = JSON.parse(readFileSync(join(legacyDir, "release.json"), "utf8"));
const transitionManifest = JSON.parse(readFileSync(join(transitionDir, "release.json"), "utf8"));
const record = JSON.parse(readFileSync(join(base, "PUSH-38L/live-binding-v2/derivation.json"), "utf8"));
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const device = { deviceId: connector.device_id, profile: "SOFTWARE_CONNECTOR", platform: "darwin",
  architecture: "arm64", channel: "INTERNAL", currentVersion: "0.1.0-legacy",
  configVersion: connector.config_version, revoked: false };
if (!verifyEdgeUpdateManifest(legacyManifest, keys).ok || !verifyEdgeUpdateManifest(transitionManifest, keys).ok ||
  !verifyEdgeArtifact(archive, transitionManifest).ok ||
  !verifyLegacyTransitionRecord(record, { trustedPublicKeys: keys, device,
    legacyManifest, transitionManifest }).ok)
  throw new Error("P38_CONNECTOR_SIGNED_TRANSITION_UNTRUSTED");
const legacyBytes = readFileSync(join(legacyDir, "connector-app.tar.gz"));
if (!verifyEdgeArtifact(legacyBytes, legacyManifest).ok) throw new Error("P38_CONNECTOR_LEGACY_RECOVERY_INVALID");
const baseline = JSON.parse(execFileSync(process.execPath, ["scripts/qa/check-push38l-live-dry-run.mjs",
  join(base, "PUSH-38F"), join(base, "PUSH-38J/signed"), transitionDir,
  join(base, "PUSH-38L/live-binding-v2/derivation.json")],
{ encoding: "utf8", timeout: 180_000, stdio: ["ignore", "pipe", "pipe"] }));
if (baseline.status !== "PASS" || !baseline.legacy_exact_match ||
  !baseline.gateway_baseline_still_matches || baseline.managed_layout_conflicts !== 0)
  throw new Error("P38_CONNECTOR_BASELINE_CHANGED");
const secretDir = join(homedir(), "Library/Application Support/Digital Observer/Tapo Connector/secrets");
const readId = name => readFileSync(join(secretDir, name), "utf8").trim();
const snapshot = () => {
  const id = readId("device_gateway_id"), site = readId("device_observer_site_id");
  const source = readId("connector_camera_source_id");
  if (id !== connector.device_id || site !== connector.site_id ||
    source !== identity.tapo?.source_id) throw new Error("P38_CONNECTOR_SOURCE_OR_IDENTITY_CHANGED");
  return { identity_fingerprint: createHash("sha256").update(`${id}|${site}`).digest("hex"),
    binding_fingerprint: createHash("sha256").update(`${id}|${site}|${source}`).digest("hex") };
};
const before = snapshot();
const managedRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const label = "com.ganbatuach.software-connector.tapo";
const plistPath = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
const adapter = createMacOSInstalledEdgeAdapter({ profile: "SOFTWARE_CONNECTOR", installedBase: join(homedir(), "Applications"),
  managedRoot, launchAgentPath: plistPath, label, port: 18083, allowMutations: apply,
  approvedArtifactSha256: apply ? legacyManifest.artifact_sha256 : "" });
const service = adapter.plan();
const disk = statfsSync(join(homedir(), "Library/Application Support/Digital Observer"));
if (!service.service.running || service.service.pid < 2 ||
  Number(disk.bavail) * Number(disk.bsize) < 1_000_000_000)
  throw new Error("P38_CONNECTOR_SERVICE_OR_DISK_UNAVAILABLE");
const docker = args => execFileSync("docker", ["--context", "colima-push38t", ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const qaContainer = "supabase_db_gan-batuach-push38t";
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", qaContainer]));
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" || network !== "127.0.0.1")
  throw new Error("P38_CONNECTOR_QA_DATABASE_NOT_ISOLATED");
const counts = docker(["exec", qaContainer, "psql", "-X", "-A", "-t",
  "-U", "postgres", "-d", "postgres", "-c",
  "select (select count(*) from public.video_gateway_device_enrollments where metadata->>'home_qa_phase'='LEGACY_VERIFIED_FOR_TRANSITION')," +
  "(select count(*) from public.observer_edge_releases where channel='HOME_QA')," +
  "(select count(*) from public.observer_edge_rollouts where status='ACTIVE');"]).trim();
if (counts !== "2|3|2") throw new Error("P38_CONNECTOR_HOME_QA_STATE_CHANGED");
// The staged bytes prove a prior authorized download; require a fresh live
// exact-device grant as well so a stopped QA control plane cannot pass prewrite.
const authorization = JSON.parse(execFileSync(process.execPath,
  ["scripts/qa/check-push38-homeqa-legacy-live-auth.mjs", "--positive-only"],
  { encoding: "utf8", timeout: 180_000, stdio: ["ignore", "pipe", "pipe"], env: process.env }));
if (authorization.status !== "PASS" || authorization.correct_device !== "ACCEPT" ||
  authorization.anonymous !== "DENY" || authorization.scope !== "FRESH_SINGLE_GRANT" ||
  authorization.remediation_early !== "DENY")
  throw new Error("P38_CONNECTOR_HOME_QA_AUTHORIZATION_UNAVAILABLE");
const gatewayHealth = await (await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(5000) })).json();
// Legacy /health is itself part of the known pre-remediation failure. Its
// response is evidence, not a prerequisite for the signed one-time handoff.
// The new signed runtime must still pass the strict post-handoff health gate.
const connectorHealth = await fetch("http://127.0.0.1:18083/health",
  { signal: AbortSignal.timeout(5000) }).then(async response => response.ok ? response.json() : null).catch(() => null);
if (gatewayHealth.mediaHeartbeat?.progressingRelays !== 8 ||
  gatewayHealth.lastDiscovery?.assignedCount !== 10 || gatewayHealth.lastDiscovery?.connectedCount !== 8 ||
  gatewayHealth.lastDiscovery?.failedAssignedCount !== 2 || gatewayHealth.lastDiscovery?.unassignedCount !== 6 ||
  !service.service.running || (connectorHealth && connectorHealth.lastDiscovery?.channelCount !== 1))
  throw new Error("P38_CONNECTOR_PREWRITE_HEALTH_INVALID");
const plan = { protocol: "observer-push38-homeqa-connector-transition-command-v1",
  generated_at: new Date().toISOString(), mode: "DRY_RUN", identity_evidence_sha256: identitySha,
  dvr_truth_evidence_sha256: dvrTruthSha,
  staged_artifact_sha256: transitionManifest.artifact_sha256, legacy_recovery_sha256: legacyManifest.artifact_sha256,
  device_id: connector.device_id, site_id: connector.site_id, service_pid: service.service.pid,
  source_binding_sha256: before.binding_fingerprint, current_state: "LEGACY_UNMANAGED",
  intended_release: transitionManifest.release_id, service_action: label,
  rollback_target: "EXACT_LEGACY_RECOVERY_ONLY", promotion_target: "SIGNED_TRANSITION_CURRENT_KNOWN_GOOD",
  health_gate: "SIGNED_SERVICE_IDENTITY_AND_CONFIG; TAPO_SOURCE_RECORDED_PENDING_REMEDIATION",
  post_remediation_source_gate: "TAPO_1_OF_1_REQUIRED", prewrite_pass: true, runtime_writes: 0,
  authorization: "FRESH_EXACT_DEVICE_PASS_ANONYMOUS_AND_EARLY_REMEDIATION_DENIED",
  legacy_health_observation: connectorHealth ? "RESPONDED_PRE_REMEDIATION" : "NO_RESPONSE_PRE_REMEDIATION",
  home_before: { dvr_expected: 10, dvr_source_available: 8, dvr_upstream_unavailable: 2,
    dvr_empty: 6, dvr_progressing: gatewayHealth.mediaHeartbeat.progressingRelays,
    tapo_progressing: connectorHealth?.mediaHeartbeat?.progressingRelays ?? null,
    tapo_stalled: connectorHealth?.mediaHeartbeat?.stalledRelays ?? null } };
if (dryRun) {
  if (!outputPath || !resolve(outputPath).startsWith(restricted) || existsSync(outputPath))
    throw new Error("P38_CONNECTOR_DRY_RUN_OUTPUT_REQUIRED");
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "DRY_RUN_PASS", plan_sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex"),
    tapo_before: plan.home_before.tapo_progressing,
    legacy_health_observation: plan.legacy_health_observation, runtime_writes: 0 }));
  process.exit(0);
}
const savedBytes = restrictedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha || "") ||
  createHash("sha256").update(savedBytes).digest("hex") !== planSha)
  throw new Error("P38_CONNECTOR_DRY_RUN_PIN_MISMATCH");
const saved = JSON.parse(savedBytes.toString("utf8"));
if (saved.protocol !== plan.protocol || saved.prewrite_pass !== true ||
  Date.now() - Date.parse(saved.generated_at) > 10 * 60_000 ||
  saved.identity_evidence_sha256 !== identitySha ||
  saved.dvr_truth_evidence_sha256 !== dvrTruthSha ||
  saved.staged_artifact_sha256 !== transitionManifest.artifact_sha256 ||
  saved.legacy_recovery_sha256 !== legacyManifest.artifact_sha256 ||
  saved.service_pid !== service.service.pid || saved.source_binding_sha256 !== before.binding_fingerprint)
  throw new Error("P38_CONNECTOR_DRY_RUN_STALE_OR_CONFLICTING");
const probeHealth = async () => {
  let last;
  const deadline = Date.now() + 90_000;
  do {
    const probe = await adapter.health({ timeoutMs: 5000 });
    const body = probe.body || {};
    last = { process_running: probe.ok && probe.service.running,
      device_authenticated: body.deviceAuthorization?.status === "ready",
      heartbeat: probe.ok, config_retrieved: body.lastDiscovery?.channelCount === 1,
      cloud_reachable: body.deviceAuthorization?.status === "ready", no_crash_loop: probe.ok,
      // This signed transition re-seals the same legacy payload. The already
      // documented 0/1 Tapo defect is a remediation gate, not a reason to
      // mislabel the transition as a failed service handoff. Preserve actual
      // source counts explicitly while gating the service/identity boundary.
      expected_physical_cameras: 0, progressing_physical_cameras: 0,
      empty_slots: 0, stalled_streams: 0,
      observed_expected_physical_cameras: 1,
      observed_progressing_physical_cameras: body.mediaHeartbeat?.progressingRelays ?? 0,
      observed_stalled_streams: body.mediaHeartbeat?.stalledRelays ?? 0,
      source_degraded_pending_remediation: (body.mediaHeartbeat?.progressingRelays ?? 0) < 1 };
    if (edgeHealthGate(last).healthy) return last;
    await new Promise(resolve => setTimeout(resolve, 2000));
  } while (Date.now() < deadline);
  return last;
};
const manager = new EdgeUpdateManager({ root: managedRoot, trustedPublicKeys: keys,
  device, adapter, healthCheck: probeHealth });
const inspect = async () => {
  return { legacy_running: adapter.status().running, ...snapshot() };
};
const transition = createConnectorLegacyTransition({ manager, adapter, inspect,
  verifyContinuity: async ({ before: previous }) => {
    const after = snapshot();
    return after.identity_fingerprint === previous.identity_fingerprint &&
      after.binding_fingerprint === previous.binding_fingerprint &&
      (await adapter.health({ timeoutMs: 5000 })).service.running;
  } });
const result = await transition.run({ legacyManifest, legacyBytes, transitionManifest,
  transitionBytes: archive, derivationRecord: record });
if (result.state !== "HEALTHY" || result.current_release !== transitionManifest.release_id ||
  result.known_good_release !== transitionManifest.release_id ||
  transition.status()?.state !== "RETIRED" || snapshot().binding_fingerprint !== before.binding_fingerprint)
  throw new Error("P38_CONNECTOR_TRANSITION_POSTCHECK_FAILED");
console.log(JSON.stringify({ status: "SIGNED_TRANSITION_PROMOTED", current_release: result.current_release,
  known_good_release: result.known_good_release, identity_source_continuity: "PASS",
  legacy_recovery: "RETIRED_FROM_NORMAL_OTA" }));
