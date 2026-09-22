// Exact Home Gateway bootstrap. Registers the signed installed baseline under
// the existing OTA manager without switching the functional runtime. Only the
// separately authenticated managed OTA agent may later apply remediation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createInstalledEdgeBootstrap } from "../../services/video-gateway/edge-installed-bootstrap.mjs";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { edgeHealthGate, EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const dryRun = process.argv.includes("--dry-run"), apply = process.argv.includes("--apply");
if (dryRun === apply) throw new Error("P38_GATEWAY_BOOTSTRAP_MODE_REQUIRED");
const identityPath = option("identity"), identitySha = option("sha256"), outputPath = option("output");
const planPath = option("plan"), planSha = option("plan-sha256");
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
function evidenceFile(path) {
  if (!path || !realpathSync(resolve(path)).startsWith(restricted) ||
    lstatSync(path).isSymbolicLink() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_RESTRICTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
if (!/^[a-f0-9]{64}$/.test(identitySha || "")) throw new Error("P38_GATEWAY_IDENTITY_PIN_REQUIRED");
const identityBytes = evidenceFile(identityPath);
if (createHash("sha256").update(identityBytes).digest("hex") !== identitySha)
  throw new Error("P38_GATEWAY_IDENTITY_EVIDENCE_CHANGED");
const identity = JSON.parse(identityBytes.toString("utf8"));
const gateway = identity.devices?.find(item => item.profile === "PHYSICAL_GATEWAY");
if (identity.protocol !== "observer-push38-home-identity-reconciliation-v1" ||
  Date.now() - Date.parse(identity.observed_at) > 60 * 60_000 ||
  gateway?.device_id !== "62df97e2-3c0b-427f-9108-bde029bc10e7" ||
  gateway.site_id !== "cc1673b8-3eb0-4785-a12c-1fb88f425a41" ||
  gateway.tenant_id !== gateway.site_id || identity.dvr?.assigned?.length !== 10 ||
  identity.dvr?.empty?.length !== 6 || gateway.identity_phase !== "LEGACY_VERIFIED_FOR_TRANSITION")
  throw new Error("P38_GATEWAY_IDENTITY_BINDING_CHANGED");
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const base = "/Volumes/DIGITAL_OBSERVER/QA-Releases";
const baselineDir = join(base, "PUSH-38J/signed/qa-legacy-gateway-91bf6814075f");
const manifest = JSON.parse(readFileSync(join(baselineDir, "release.json"), "utf8"));
const bytes = readFileSync(join(baselineDir, "gateway-runtime.tar.gz"));
if (manifest.release_id !== "qa-legacy-gateway-91bf6814075f" ||
  manifest.artifact_sha256 !== "91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d" ||
  !verifyEdgeUpdateManifest(manifest, keys).ok || !verifyEdgeArtifact(bytes, manifest).ok)
  throw new Error("P38_GATEWAY_SIGNED_BASELINE_INVALID");
const legacy = JSON.parse(execFileSync(process.execPath, ["scripts/qa/check-push38l-live-dry-run.mjs",
  join(base, "PUSH-38F"), join(base, "PUSH-38J/signed"),
  join(base, "PUSH-38L/qa-connector-legacy-transition-v2-6e7988808b05"),
  join(base, "PUSH-38L/live-binding-v2/derivation.json")],
{ encoding: "utf8", timeout: 180_000, stdio: ["ignore", "pipe", "pipe"] }));
if (legacy.status !== "PASS" || !legacy.gateway_baseline_still_matches)
  throw new Error("P38_GATEWAY_LEGACY_BASELINE_CHANGED");
const store = createKeychainStore({ service: "com.ganbatuach.video-gateway.runtime" });
const installedDevice = await store.read("device_gateway_id"), installedSite = await store.read("device_observer_site_id");
if (installedDevice !== gateway.device_id || installedSite !== gateway.site_id)
  throw new Error("P38_GATEWAY_INSTALLED_IDENTITY_CHANGED");
const sourceBinding = createHash("sha256").update(JSON.stringify({ site: gateway.site_id,
  assigned: identity.dvr.assigned, empty: identity.dvr.empty })).digest("hex");
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const label = "com.ganbatuach.video-gateway";
const adapter = createMacOSInstalledEdgeAdapter({ profile: "PHYSICAL_GATEWAY",
  installedBase: join(homedir(), ".local/share/gan-batuach/video-gateway"), managedRoot: root,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${label}.plist`), label, port: 18082,
  allowMutations: apply, approvedArtifactSha256: apply ? manifest.artifact_sha256 : "" });
const service = adapter.plan();
if (!service.service.running || service.service.pid < 2) throw new Error("P38_GATEWAY_SERVICE_NOT_RUNNING");
const probe = await adapter.health({ timeoutMs: 5000 });
const availableChannels = identity.dvr.source_available?.map(row => row.channel).sort((a, b) => a - b);
const unavailableChannels = identity.dvr.upstream_unavailable?.map(row => row.channel).sort((a, b) => a - b);
const observedChannels = (probe.body?.mediaHeartbeat?.inputs || []).map(row => row.channel).sort((a, b) => a - b);
if (!probe.ok || !probe.service.running ||
  JSON.stringify(availableChannels) !== "[1,3,4,5,6,7,10,11]" ||
  JSON.stringify(unavailableChannels) !== "[2,8]" ||
  JSON.stringify(observedChannels) !== JSON.stringify(availableChannels) ||
  probe.body?.mediaHeartbeat?.progressingRelays !== 8 ||
  probe.body?.mediaHeartbeat?.stalledRelays !== 0 ||
  probe.body?.lastDiscovery?.assignedCount !== 10 ||
  probe.body?.lastDiscovery?.connectedCount !== 8 ||
  probe.body?.lastDiscovery?.failedAssignedCount !== 2 ||
  probe.body?.lastDiscovery?.unassignedCount !== 6 ||
  probe.body?.deviceAuthorization?.status !== "ready")
  throw new Error("P38_GATEWAY_PREWRITE_SOURCE_AVAILABILITY_CHANGED");
const plan = { protocol: "observer-push38-homeqa-gateway-bootstrap-command-v1",
  generated_at: new Date().toISOString(), mode: "DRY_RUN", prewrite_pass: true, runtime_writes: 0,
  identity_evidence_sha256: identitySha, device_id: gateway.device_id, site_id: gateway.site_id,
  source_binding_sha256: sourceBinding, service_pid: service.service.pid,
  intended_release: manifest.release_id, artifact_sha256: manifest.artifact_sha256,
  service_action: "REGISTER_SIGNED_BASELINE_WITHOUT_RESTART",
  rollback_target: "EXACT_LEGACY_LAUNCHAGENT_AND_SIGNED_BASELINE_ABORT",
  promotion_target: "SIGNED_BASELINE_CURRENT_KNOWN_GOOD",
  health_gate: "DVR_8_OF_8_SOURCE_AVAILABLE; 2_OF_10_UPSTREAM_UNAVAILABLE; 6_EMPTY",
  dvr: { expected_physical: 10, source_available: 8, upstream_unavailable: 2, empty: 6 } };
if (dryRun) {
  if (!outputPath || !resolve(outputPath).startsWith(restricted) || existsSync(outputPath))
    throw new Error("P38_GATEWAY_PLAN_OUTPUT_REQUIRED");
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "DRY_RUN_PASS", plan_sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex"),
    dvr_expected: 10, dvr_source_available: 8, dvr_progressing: 8,
    dvr_upstream_unavailable: 2, runtime_writes: 0 }));
  process.exit(0);
}
const priorBytes = evidenceFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha || "") ||
  createHash("sha256").update(priorBytes).digest("hex") !== planSha)
  throw new Error("P38_GATEWAY_PLAN_PIN_MISMATCH");
const prior = JSON.parse(priorBytes.toString("utf8"));
if (prior.protocol !== plan.protocol || prior.prewrite_pass !== true ||
  Date.now() - Date.parse(prior.generated_at) > 10 * 60_000 ||
  prior.identity_evidence_sha256 !== identitySha || prior.source_binding_sha256 !== sourceBinding ||
  prior.service_pid !== service.service.pid || prior.artifact_sha256 !== manifest.artifact_sha256)
  throw new Error("P38_GATEWAY_PLAN_STALE_OR_CONFLICTING");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const connectorCurrent = JSON.parse(readFileSync(join(connectorRoot, "current.json"), "utf8"));
const connectorKnownGood = JSON.parse(readFileSync(join(connectorRoot, "known-good.json"), "utf8"));
const connectorState = JSON.parse(readFileSync(join(connectorRoot, "update-state.json"), "utf8"));
const connectorHealth = await (await fetch("http://127.0.0.1:18083/health",
  { signal: AbortSignal.timeout(5000) })).json();
const requiredConnector = { release_id: "qa-p38-health-connector-startup-d44b7e4262f9",
  artifact_sha256: "d44b7e4262f9a7c9051a8c3e15258c612791546b1bfeaddf6f95c04ee706d388" };
const connectorKnownGoodPointer = connectorKnownGood.find(item =>
  item.release_id === requiredConnector.release_id &&
  item.artifact_sha256 === requiredConnector.artifact_sha256 && item.trusted === true);
if (connectorCurrent.release_id !== requiredConnector.release_id ||
  connectorCurrent.artifact_sha256 !== requiredConnector.artifact_sha256 ||
  !connectorKnownGoodPointer ||
  connectorState.release_id !== requiredConnector.release_id ||
  connectorState.state !== "HEALTHY" || connectorHealth.mediaHeartbeat?.progressingRelays !== 1 ||
  connectorHealth.mediaHeartbeat?.stalledRelays !== 0)
  throw new Error("P38_GATEWAY_CONNECTOR_REMEDIATION_PREREQUISITE_FAILED");
const device = { deviceId: gateway.device_id, profile: "PHYSICAL_GATEWAY", platform: "darwin",
  architecture: "arm64", channel: "INTERNAL", currentVersion: "0.1.0-legacy",
  configVersion: gateway.config_version, revoked: false };
const healthCheck = async () => {
  const next = await adapter.health({ timeoutMs: 5000 });
  return { process_running: next.ok && next.service.running,
    device_authenticated: next.body?.deviceAuthorization?.status === "ready",
    heartbeat: next.ok, config_retrieved: next.body?.lastDiscovery?.assignedCount === 10 &&
      next.body?.lastDiscovery?.connectedCount === 8 && next.body?.lastDiscovery?.failedAssignedCount === 2,
    cloud_reachable: next.body?.deviceAuthorization?.status === "ready", no_crash_loop: next.ok,
    expected_physical_cameras: 8, configured_physical_cameras: 10,
    known_upstream_unavailable: 2,
    progressing_physical_cameras: next.body?.mediaHeartbeat?.progressingRelays ?? 0,
    empty_slots: next.body?.lastDiscovery?.unassignedCount ?? 0,
    stalled_streams: next.body?.mediaHeartbeat?.stalledRelays ?? 0 };
};
const manager = new EdgeUpdateManager({ root, trustedPublicKeys: keys, device, adapter, healthCheck });
const inspect = async () => {
  const next = await adapter.health({ timeoutMs: 5000 });
  return { legacy_running: next.ok && next.service.running,
    identity_fingerprint: createHash("sha256").update(`${installedDevice}|${installedSite}`).digest("hex"),
    binding_fingerprint: sourceBinding, service_pid: next.service.pid };
};
const bootstrap = createInstalledEdgeBootstrap({ root, manager, adapter,
  trust: { verify: async ({ manifest: incoming }) => {
    if (!verifyEdgeUpdateManifest(incoming, keys).ok) throw new Error("P38_GATEWAY_TRUST_FAILED");
  } }, inspect, verifyContinuity: async ({ before }) => {
    const after = await inspect();
    return after.legacy_running && after.service_pid === before.service_pid &&
      after.identity_fingerprint === before.identity_fingerprint &&
      after.binding_fingerprint === before.binding_fingerprint &&
      edgeHealthGate(await healthCheck()).healthy;
  } });
const result = await bootstrap.run({ manifest, artifactBytes: bytes, approvedSha256: manifest.artifact_sha256 });
if (result.state !== "COMPLETE" || result.current_release !== manifest.release_id ||
  result.known_good_release !== manifest.release_id)
  throw new Error("P38_GATEWAY_BOOTSTRAP_POSTCHECK_FAILED");
console.log(JSON.stringify({ status: "SIGNED_BASELINE_REGISTERED", current_release: result.current_release,
  known_good_release: result.known_good_release, functional_runtime_replaced: false,
  dvr_expected: 10, dvr_source_available: 8, dvr_progressing: 8,
  dvr_upstream_unavailable: 2, source_continuity: "PASS" }));
