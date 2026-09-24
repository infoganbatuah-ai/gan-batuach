import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { createConnectorLegacyTransition, verifyLegacyTransitionRecord } from "../../services/video-gateway/edge-connector-legacy-transition.mjs";

const [legacyStore, transitionStore, remediationStore] = process.argv.slice(2);
if (!legacyStore || !transitionStore || !remediationStore) throw new Error("P38L_QA_STORES_REQUIRED");
const legacyDir = join(legacyStore, "qa-legacy-connector-ee82c20a77ac");
const legacy = JSON.parse(readFileSync(join(legacyDir, "release.json")));
const legacyBytes = readFileSync(join(legacyDir, "connector-app.tar.gz"));
const transition = JSON.parse(readFileSync(join(transitionStore, "release.json")));
const transitionBytes = readFileSync(join(transitionStore, "connector-legacy-resigned.tar.gz"));
const record = JSON.parse(readFileSync(join(transitionStore, "derivation.json")));
const remediationDir = join(remediationStore, "qa-p38i-connector-069c91593f8b");
const remediation = JSON.parse(readFileSync(join(remediationDir, "release.json")));
const remediationBytes = readFileSync(join(remediationDir, "connector-remediation.tar.gz"));
const trusted = JSON.parse(readFileSync(join(legacyStore, "qa-trust-registry.json"))).trustedPublicKeys;
const device = { deviceId: "qa-connector-device", profile: "SOFTWARE_CONNECTOR", platform: "darwin",
  architecture: "arm64", channel: "INTERNAL", currentVersion: "0.1.0-legacy", configVersion: 1, revoked: false };
const altered = structuredClone(record); altered.payload_equivalence_sha256 = "f".repeat(64);
assert.equal(verifyLegacyTransitionRecord(altered, { trustedPublicKeys: trusted, device,
  legacyManifest: legacy, transitionManifest: transition }).ok, false);
assert.equal(verifyLegacyTransitionRecord(record, { trustedPublicKeys: trusted,
  device: { ...device, deviceId: "qa-other-device" }, legacyManifest: legacy,
  transitionManifest: transition }).ok, false);

async function fixture(failTransition) {
  const root = mkdtempSync(join(tmpdir(), "observer-p38l-policy-"));
  const persistent = join(root, "persistent"); mkdirSync(persistent, { mode: 0o700 });
  for (const name of ["identity", "config", "queue", "site-source", "trust"])
    writeFileSync(join(persistent, name), `QA_PERSISTENT_${name}`, { mode: 0o600 });
  let running = "legacy", restores = 0, restarts = 0;
  const adapter = {
    verifyLegacyInstalled: async ({ manifest, legacyRecoveryOnly }) =>
      legacyRecoveryOnly && manifest.release_id === legacy.release_id,
    install: async ({ manifest, staging }) => {
      if (manifest.profile !== device.profile) throw Error("QA_WRONG_PROFILE");
      mkdirSync(join(staging, "runtime"), { mode: 0o700 });
      writeFileSync(join(staging, "runtime", "qa-service"), manifest.release_id);
    },
    restart: async ({ manifest }) => { running = manifest.release_id; restarts++; },
    restoreLegacy: async () => { running = "legacy"; restores++; }
  };
  const healthCheck = async ({ transition: initialTransition }) => ({
    process_running: !(failTransition && initialTransition), device_authenticated: true,
    heartbeat: true, config_retrieved: true, cloud_reachable: true, no_crash_loop: true,
    expected_physical_cameras: 0, progressing_physical_cameras: 0, empty_slots: 0, stalled_streams: 0 });
  const manager = new EdgeUpdateManager({ root: join(root, "ota"), trustedPublicKeys: trusted,
    device, adapter, healthCheck });
  const coordinator = createConnectorLegacyTransition({ manager, adapter,
    inspect: async () => ({ legacy_running: running === "legacy",
      identity_fingerprint: "qa-identity-fingerprint", binding_fingerprint: "qa-site-source-fingerprint" }),
    verifyContinuity: async () => running === transition.release_id });
  const input = { legacyManifest: legacy, legacyBytes, transitionManifest: transition,
    transitionBytes, derivationRecord: record };
  return { root, persistent, manager, coordinator, input, adapter, get running() { return running; },
    get restores() { return restores; }, get restarts() { return restarts; } };
}
const good = await fixture(false);
try {
  assert.equal(good.manager.current().slot, null);
  await assert.rejects(good.coordinator.run({ ...good.input, derivationRecord: altered }),
    /EDGE_LEGACY_TRANSITION_SIGNATURE_INVALID/);
  assert.equal(good.coordinator.status(), null);
  await assert.rejects(good.coordinator.run({ ...good.input, transitionManifest: legacy }),
    /EDGE_LEGACY_TRANSITION_RELEASE_UNTRUSTED/);
  assert.equal(good.coordinator.status(), null);
  await assert.rejects(good.manager.bootstrapInstalled({ manifest: legacy, artifactBytes: legacyBytes }),
    /EDGE_UPDATE_INSTALLED_VERIFIER_REQUIRED/);
  assert.equal(good.manager.current().slot, null);
  await assert.rejects(good.manager.apply({ manifest: remediation, artifactBytes: remediationBytes }),
    /EDGE_UPDATE_SIGNED_BOOTSTRAP_REQUIRED/);
  const promoted = await good.coordinator.run(good.input);
  assert.equal(promoted.state, "HEALTHY");
  assert.equal(promoted.current_release, transition.release_id);
  assert.equal(promoted.known_good_release, transition.release_id);
  assert.equal(good.coordinator.status().state, "RETIRED");
  assert.equal(good.manager.current().artifact_sha256, transition.artifact_sha256);
  assert.equal(good.manager.knownGood().at(-1).artifact_sha256, transition.artifact_sha256);
  await assert.rejects(good.coordinator.run(good.input), /EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY/);
  await assert.rejects(good.coordinator.recover(), /EDGE_LEGACY_RECOVERY_RETIRED/);
  await assert.rejects(good.manager.bootstrapInstalled({ manifest: legacy, artifactBytes: legacyBytes }),
    /EDGE_UPDATE_BOOTSTRAP_CONFLICT/);
  await assert.rejects(good.manager.apply({ manifest: legacy, artifactBytes: legacyBytes }),
    /EDGE_LEGACY_RECOVERY_NOT_OTA/);
  const updated = await good.manager.apply({ manifest: remediation, artifactBytes: remediationBytes });
  assert.equal(updated.state, "HEALTHY");
  assert.equal(good.manager.current().release_id, remediation.release_id);
  const rollback = await good.manager.rollbackAfterCrashLoop({ reason: "QA_CONTROLLED_CRASH_LOOP" });
  assert.equal(rollback.state, "ROLLED_BACK");
  assert.equal(good.manager.current().release_id, transition.release_id);
  assert.equal(good.manager.current().artifact_sha256, transition.artifact_sha256);
  assert.equal(good.coordinator.status().state, "RETIRED");
  for (const name of ["identity", "config", "queue", "site-source", "trust"])
    assert.equal(readFileSync(join(good.persistent, name), "utf8"), `QA_PERSISTENT_${name}`);
} finally { rmSync(good.root, { recursive: true, force: true }); }
const bad = await fixture(true);
try {
  await assert.rejects(bad.coordinator.run(bad.input), /EDGE_UPDATE_HEALTH_PROCESS_RUNNING_FAILED/);
  assert.equal(bad.running, "legacy");
  assert.equal(bad.restores, 1);
  assert.equal(bad.coordinator.status().state, "ACTION_REQUIRED");
  assert.equal(bad.coordinator.status().recovery_used, true);
  assert.equal(bad.manager.current().slot, null);
  assert.equal(bad.manager.knownGood().length, 0);
  await assert.rejects(bad.coordinator.run(bad.input), /EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY/);
  await assert.rejects(bad.coordinator.run(bad.input, { retryRecoveredFailure: true }),
    /EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY/);
  await assert.rejects(bad.manager.apply({ manifest: remediation, artifactBytes: remediationBytes }),
    /EDGE_UPDATE_SIGNED_BOOTSTRAP_REQUIRED/);
} finally { rmSync(bad.root, { recursive: true, force: true }); }
const retry = await fixture(false);
try {
  let firstTransitionHealth = true;
  retry.manager.healthCheck = async ({ transition: initialTransition }) => ({
    process_running: true, device_authenticated: !(initialTransition && firstTransitionHealth),
    heartbeat: true, config_retrieved: true, cloud_reachable: true, no_crash_loop: true,
    expected_physical_cameras: 0, progressing_physical_cameras: 0, empty_slots: 0, stalled_streams: 0 });
  await assert.rejects(retry.coordinator.run(retry.input), /EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED/);
  firstTransitionHealth = false;
  assert.equal(retry.coordinator.status().state, "ACTION_REQUIRED");
  assert.equal(retry.coordinator.status().recovery_used, true);
  await assert.rejects(retry.coordinator.run(retry.input), /EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY/);
  const promoted = await retry.coordinator.run(retry.input, { retryRecoveredFailure: true });
  assert.equal(promoted.state, "HEALTHY");
  assert.equal(retry.coordinator.status().state, "RETIRED");
  assert.equal(retry.coordinator.status().attempts, 2);
  assert.equal(retry.coordinator.status().retry_of_failure, "EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED");
  await assert.rejects(retry.coordinator.run(retry.input, { retryRecoveredFailure: true }),
    /EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY/);
} finally { rmSync(retry.root, { recursive: true, force: true }); }
const chainedRetry = await fixture(false);
try {
  let healthPhase = "auth";
  chainedRetry.manager.healthCheck = async ({ transition: initialTransition }) => ({
    process_running: true,
    device_authenticated: !(initialTransition && healthPhase === "auth"),
    heartbeat: true,
    config_retrieved: !(initialTransition && healthPhase === "config"),
    cloud_reachable: true, no_crash_loop: true,
    expected_physical_cameras: 0, progressing_physical_cameras: 0, empty_slots: 0, stalled_streams: 0 });
  await assert.rejects(chainedRetry.coordinator.run(chainedRetry.input),
    /EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED/);
  healthPhase = "config";
  await assert.rejects(chainedRetry.coordinator.run(chainedRetry.input, { retryRecoveredFailure: true }),
    /EDGE_UPDATE_HEALTH_CONFIG_RETRIEVED_FAILED/);
  assert.equal(chainedRetry.coordinator.status().attempts, 2);
  assert.deepEqual(chainedRetry.coordinator.status().retry_failures,
    ["EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED"]);
  healthPhase = "healthy";
  const promoted = await chainedRetry.coordinator.run(chainedRetry.input, { retryRecoveredFailure: true });
  assert.equal(promoted.state, "HEALTHY");
  assert.equal(chainedRetry.coordinator.status().attempts, 3);
  assert.deepEqual(chainedRetry.coordinator.status().retry_failures, [
    "EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED",
    "EDGE_UPDATE_HEALTH_CONFIG_RETRIEVED_FAILED"
  ]);
  await assert.rejects(chainedRetry.coordinator.run(chainedRetry.input, { retryRecoveredFailure: true }),
    /EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY/);
} finally { rmSync(chainedRetry.root, { recursive: true, force: true }); }
console.log(JSON.stringify({ status: "PASS", evidence_level: "isolated policy/adapter fixture",
  payload_equivalence_record: record.payload_equivalence_sha256, transition_release: transition.release_id,
  migration_failure_legacy_recovery: "PASS", bounded_recovered_retry: "PASS",
  bounded_two_failure_chain_retry: "PASS", no_retry_loop: "PASS",
  transition_promoted_signed_known_good: "PASS", normal_ota_remediation: "PASS",
  crash_rollback_target: transition.release_id, legacy_retired_from_normal_ota: "PASS",
  device_binding_negative: "PASS", tampered_record_negative: "PASS", state_fixtures_preserved: "PASS" }));
