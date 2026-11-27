import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalEdgeUpdateManifest, evaluateEdgeUpdateEligibility, shouldPauseRollout, verifyEdgeUpdateManifest
} from "../../services/video-gateway/edge-update-contract.mjs";
import { EdgeUpdateManager, edgeHealthGate } from "../../services/video-gateway/edge-update-manager.mjs";
import { createEdgeCrashLoopGuard } from "../../services/video-gateway/edge-crash-loop-guard.mjs";

const pair = generateKeyPairSync("ed25519");
const keyId = "release-key-2026-01";
const publicKey = pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url");
const trusted = { [keyId]: publicKey };
const artifact = Buffer.from("reviewed isolated Observer Edge QA artifact\n");
const digest = createHash("sha256").update(artifact).digest("hex");

function manifest({ version, profile = "SOFTWARE_CONNECTOR", platform = "darwin", architecture = "arm64", release = `qa-${version}` }) {
  const value = { protocol: "observer-edge-update-v1", release_id: release, version, build_sha: createHash("sha256").update(release).digest("hex"),
    channel: "CANARY", platform, architecture, profile, artifact_url: `https://updates.example.invalid/${release}.artifact`,
    artifact_sha256: digest, artifact_size: artifact.length, signing_key_id: keyId,
    compatibility: { minimum_current_version: "1.0.0", maximum_current_version: "2.0.0", minimum_config_version: 1, maximum_config_version: 4, security_floor_version: "1.0.0" },
    released_at: new Date().toISOString(), rollout: { stage: "CANARY", cohort_seed: "qa-seed-2026", cohort_percent: 100, explicit_device_ids: [] }, signature: "" };
  value.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(value)), pair.privateKey).toString("base64url");
  return value;
}
const healthy = (expected = 0, empty = 0) => ({ process_running: true, device_authenticated: true, heartbeat: true,
  config_retrieved: true, cloud_reachable: true, no_crash_loop: true, expected_physical_cameras: expected,
  progressing_physical_cameras: expected, empty_slots: empty, stalled_streams: 0 });
const adapter = { async verifyInstalled() { return true; }, async stageBaseline({ staging, manifest: value }) { writeFileSync(join(staging, "installed-version"), value.version); },
  async install({ staging, manifest: value }) { writeFileSync(join(staging, "installed-version"), value.version); }, async restart() {} };
async function manager(profile, healthCheck) {
  const root = mkdtempSync(join(tmpdir(), "observer-edge-ota-"));
  const identityPath = join(root, "..", `${profile}-identity.fixture`); writeFileSync(identityPath, "PRIVATE-IDENTITY-REMAINS-OUTSIDE-UPDATE-ROOT", { mode: 0o600 });
  const value = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
    device: { deviceId: `qa-${profile.toLowerCase()}-device`, profile, platform: "darwin", architecture: "arm64", channel: "CANARY",
      currentVersion: "1.0.0", buildSha: "good-build", configVersion: 1, revoked: false }, adapter, healthCheck });
  await value.bootstrapInstalled({ manifest: manifest({ version: "1.0.0", profile, release: `qa-baseline-${profile.toLowerCase()}` }), artifactBytes: artifact });
  return { value, root, identityPath, identity: readFileSync(identityPath, "utf8") };
}

// Cryptographic release authenticity and supply-chain negatives.
const goodManifest = manifest({ version: "1.1.0" });
assert.equal(verifyEdgeUpdateManifest(goodManifest, trusted).ok, true);
assert.equal(verifyEdgeUpdateManifest({ ...goodManifest, build_sha: "a".repeat(64) }, trusted).ok, false, "tampered manifest rejected");
assert.equal(verifyEdgeUpdateManifest(goodManifest, {}).reason, "EDGE_UPDATE_SIGNING_KEY_UNTRUSTED");
assert.equal(evaluateEdgeUpdateEligibility(goodManifest, { deviceId: "qa-software_connector-device", profile: "PHYSICAL_GATEWAY", platform: "darwin", architecture: "arm64", channel: "CANARY", currentVersion: "1.0.0", configVersion: 1 }).reason, "EDGE_UPDATE_PROFILE_MISMATCH");
assert.equal(evaluateEdgeUpdateEligibility(goodManifest, { deviceId: "qa-software_connector-device", profile: "SOFTWARE_CONNECTOR", platform: "win32", architecture: "x64", channel: "CANARY", currentVersion: "1.0.0", configVersion: 1 }).reason, "EDGE_UPDATE_PLATFORM_MISMATCH");
assert.equal(evaluateEdgeUpdateEligibility(goodManifest, { deviceId: "qa-software_connector-device", profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64", channel: "CANARY", currentVersion: "1.0.0", configVersion: 1, revoked: true }).reason, "EDGE_UPDATE_DEVICE_REVOKED");

// GOOD VERSION -> signed update -> verify -> atomic slot -> restart -> health -> promote.
const connector = await manager("SOFTWARE_CONNECTOR", async () => healthy(1, 0));
const connectorBaseline = manifest({ version: "1.0.0", release: "qa-baseline-software_connector" });
assert.equal((await connector.value.bootstrapInstalled({ manifest: connectorBaseline, artifactBytes: artifact })).release_id, connectorBaseline.release_id, "bootstrap idempotent");
assert.equal(connector.value.releaseStatus().known_good_release, connectorBaseline.release_id);
await assert.rejects(connector.value.bootstrapInstalled({ manifest: { ...connectorBaseline, release_id: "tampered" }, artifactBytes: artifact }), /EDGE_UPDATE_SIGNATURE_INVALID/);
const promoted = await connector.value.apply({ manifest: goodManifest, artifactBytes: artifact });
assert.equal(promoted.state, "HEALTHY"); assert.equal(connector.value.current().version, "1.1.0");
assert.equal(connector.value.knownGood().at(-1).version, "1.1.0");
assert.equal(readFileSync(connector.identityPath, "utf8"), connector.identity, "device identity preserved");

// Controlled bad update: install occurs, camera health fails, rollback and recovery are automatic.
const badManifest = manifest({ version: "1.2.0", release: "qa-controlled-bad-1.2.0" });
connector.value.healthCheck = async ({ version, rollback }) => version === "1.2.0" && !rollback
  ? { ...healthy(1, 0), progressing_physical_cameras: 0 } : healthy(1, 0);
const rolledBack = await connector.value.apply({ manifest: badManifest, artifactBytes: artifact });
assert.equal(rolledBack.state, "ROLLED_BACK"); assert.equal(connector.value.current().version, "1.1.0");
assert.equal(connector.value.quarantine().some(item => item.release_id === badManifest.release_id), true);
assert.equal(readFileSync(connector.identityPath, "utf8"), connector.identity);

// Artifact tamper and interrupted phases never promote an incomplete slot.
const tamper = await manager("SOFTWARE_CONNECTOR", async () => healthy(1));
await assert.rejects(tamper.value.apply({ manifest: goodManifest, artifactBytes: Buffer.from("tampered") }), /EDGE_UPDATE_ARTIFACT/);
assert.equal(tamper.value.current().version, "1.0.0");
const interrupted = await manager("SOFTWARE_CONNECTOR", async () => healthy(1));
await assert.rejects(interrupted.value.apply({ manifest: goodManifest, artifactBytes: artifact, interruptAt: "STAGED" }), /EDGE_UPDATE_INTERRUPTED_STAGING/);
assert.equal(interrupted.value.current().version, "1.0.0"); assert.equal(interrupted.value.status().state, "UPDATE_FAILED");

// Physical Gateway uses the same manager and empty DVR capacity is not a failed camera.
const gatewayManifest = manifest({ version: "1.1.0", profile: "PHYSICAL_GATEWAY", release: "qa-gateway-1.1.0" });
const gateway = await manager("PHYSICAL_GATEWAY", async () => healthy(10, 6));
assert.equal((await gateway.value.apply({ manifest: gatewayManifest, artifactBytes: artifact })).state, "HEALTHY");
assert.deepEqual(edgeHealthGate(healthy(10, 6)), { healthy: true, reason: "EDGE_UPDATE_HEALTHY", expected_physical_cameras: 10, progressing_physical_cameras: 10, empty_slots_ignored: 6 });
gateway.value.healthCheck = async ({ version, rollback }) => version === "1.2.0" && !rollback
  ? { ...healthy(10, 6), progressing_physical_cameras: 0 } : healthy(10, 6);
assert.equal((await gateway.value.apply({ manifest: manifest({ version: "1.2.0", profile: "PHYSICAL_GATEWAY", release: "qa-gateway-bad-1.2.0" }), artifactBytes: artifact })).state, "ROLLED_BACK");
assert.equal(gateway.value.current().version, "1.1.0");
// A post-promotion persistent crash must restore the exact prior signed slot.
for (const profile of ["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"]) {
  const test = await manager(profile, async () => healthy(profile === "PHYSICAL_GATEWAY" ? 10 : 1, profile === "PHYSICAL_GATEWAY" ? 6 : 0));
  const update = manifest({ version: "1.1.0", profile, release: `qa-late-crash-${profile}` });
  assert.equal((await test.value.apply({ manifest: update, artifactBytes: artifact })).state, "HEALTHY");
  let clock = 1_000;
  const guard = createEdgeCrashLoopGuard({ statePath: join(test.root, "crash-guard.json"), manager: test.value,
    now: () => clock, threshold: 3, windowMs: 120_000, stableResetMs: 60_000 });
  await guard.observe({ runtimePid: 101, healthy: true });
  for (const pid of [102, 103]) { clock += 1_000; assert.equal((await guard.observe({ runtimePid: pid, healthy: true })).action, "OBSERVING"); }
  // No reset after a few seconds; a truly stable minute does reset history.
  clock += 60_000; assert.equal(guard.status().crashes.length, 2);
  await guard.observe({ runtimePid: 103, healthy: true });
  assert.equal(guard.status().crashes.length, 0);
  for (const pid of [104, 105]) { clock += 1_000; assert.equal((await guard.observe({ runtimePid: pid, healthy: true })).action, "OBSERVING"); }
  clock += 1_000;
  assert.equal((await guard.observe({ runtimePid: 106, healthy: true })).action, "ROLLED_BACK");
  assert.equal(test.value.current().version, "1.0.0");
  assert.equal(test.value.knownGood().at(-1).version, "1.0.0");
  assert.equal(test.value.quarantine().some(item => item.release_id === update.release_id), true);
  assert.equal(createHash("sha256").update(readFileSync(join(test.value.current().slot, "artifact.bin"))).digest("hex"), digest);
  assert.equal(readFileSync(test.identityPath, "utf8"), test.identity);
  // A failing restored baseline must terminate rather than alternate slots.
  clock += 1_000; await guard.observe({ runtimePid: 201, healthy: true });
  for (const pid of [202, 203, 204]) { clock += 1_000; await guard.observe({ runtimePid: pid, healthy: false }); }
  assert.equal(test.value.status().state, "ACTION_REQUIRED");
}
// A newly promoted process that remains down is not allowed to wait forever
// for a third PID transition. One transient probe cannot trigger rollback.
const down = await manager("PHYSICAL_GATEWAY", async () => healthy(10, 6));
assert.equal((await down.value.apply({ manifest: manifest({ version: "1.1.0", profile: "PHYSICAL_GATEWAY", release: "qa-sustained-down" }), artifactBytes: artifact })).state, "HEALTHY");
let downClock = 1000;
const downGuard = createEdgeCrashLoopGuard({ statePath: join(down.root, "sustained-down.json"), manager: down.value,
  now: () => downClock, sustainedDownMs: 60_000 });
await downGuard.observe({ runtimePid: 301, healthy: true });
downClock += 1000;
assert.equal((await downGuard.observe({ runtimePid: null, healthy: false })).action, "OBSERVING");
downClock += 60_000;
assert.equal((await downGuard.observe({ runtimePid: null, healthy: false })).action, "ROLLED_BACK");
assert.equal(down.value.current().version, "1.0.0");
for (const profile of ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"]) {
  const root = mkdtempSync(join(tmpdir(), "observer-edge-bootstrap-negative-"));
  const device = { deviceId: `qa-${profile.toLowerCase()}-device`, profile, platform: "darwin", architecture: "arm64",
    channel: "CANARY", currentVersion: "1.0.0", buildSha: "unknown", configVersion: 1 };
  const failed = new EdgeUpdateManager({ root, trustedPublicKeys: trusted, device,
    adapter: { ...adapter, async verifyInstalled() { return false; } }, healthCheck: async () => healthy(profile === "PHYSICAL_GATEWAY" ? 10 : 1, profile === "PHYSICAL_GATEWAY" ? 6 : 0) });
  const baseline = manifest({ version: "1.0.0", profile, release: `qa-negative-${profile}` });
  await assert.rejects(failed.bootstrapInstalled({ manifest: { ...baseline, signature: "a".repeat(86) }, artifactBytes: artifact }), /EDGE_UPDATE_SIGNATURE_INVALID/);
  await assert.rejects(failed.bootstrapInstalled({ manifest: baseline, artifactBytes: artifact }), /EDGE_UPDATE_INSTALLED_ARTIFACT_MISMATCH/);
  assert.equal(failed.current().slot, null);
  assert.equal(failed.knownGood().length, 0);
}

// Canary containment and downgrade/replay policy.
assert.equal(shouldPauseRollout({ failedCanaries: 1, unhealthyCanaries: 0, failureThreshold: 1 }), true);
await assert.rejects(connector.value.apply({ manifest: manifest({ version: "1.0.0", release: "qa-old-replay" }), artifactBytes: artifact }), /EDGE_UPDATE_DOWNGRADE_REJECTED/);

// Static integration contract: authenticated device endpoints, admin authorization, RLS and packaged agent.
const deviceRoute = readFileSync("app/api/video-gateway/edge-updates/route.ts", "utf8");
const adminRoute = readFileSync("app/api/digital-observer/admin/edge-releases/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260909010000_edge_ota_rollout.sql", "utf8");
const terminalMigration = readFileSync("supabase/migrations/20260913010000_edge_ota_terminal_recovery.sql", "utf8");
const mac = readFileSync("scripts/build-connector-macos.mjs", "utf8"), windows = readFileSync("scripts/build-connector-windows.mjs", "utf8");
for (const token of ["UPDATE_READ", "UPDATE_STATUS", "deployment_profile", "credential_version", "lifecycle_state"]) assert.match(deviceRoute, new RegExp(token));
assert.match(deviceRoute, /ACTION_REQUIRED/);
assert.match(terminalMigration, /ACTION_REQUIRED/);
for (const token of ["hasObserverAdminClaim", "verifyEdgeUpdateManifest", "writeAuditEvent", "CANARY_HEALTH_GATE_FAILED"]) assert.match(adminRoute, new RegExp(token));
for (const table of ["observer_edge_releases", "observer_edge_rollouts", "observer_edge_device_updates"]) assert.match(migration, new RegExp(`enable row level security;[\\s\\S]*${table}|${table}[\\s\\S]*enable row level security`));
assert.match(mac, /edge-update-agent|readdirSync\("services\/video-gateway"\)/); assert.match(windows, /edge-update-agent|readdirSync\("services\/video-gateway"\)/);
assert.equal(existsSync("services/video-gateway/edge-update-agent.mjs"), true);

console.log(JSON.stringify({ status: "PASS", protocol: "observer-edge-update-v1", release_signing: "Ed25519",
  successful_update: "1.0.0->1.1.0 HEALTHY", controlled_bad_release: "1.2.0->health failure->automatic rollback->1.1.0 HEALTHY",
  profiles: ["SOFTWARE_CONNECTOR","PHYSICAL_GATEWAY"], canary_containment: true, empty_dvr_slots_ignored: 6,
  device_identity_preserved: true, live_components_touched: false }));
