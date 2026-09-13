// Full isolated launchd/slot qualification. Unique QA labels and ports only;
// no live LaunchAgent, device identity, camera configuration or Site is used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";
import http from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { createQaLaunchdEdgeAdapter } from "../../services/video-gateway/edge-update-launchd-adapter.mjs";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { generateManagedDeviceKeyPair } from "../../services/video-gateway/managed-device-auth.mjs";
import { createInstalledEdgeBootstrap } from "../../services/video-gateway/edge-installed-bootstrap.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
for (const name of ["--baseline-store", "--release-store", "--qa-private-key", "--connector-baseline-id"])
  if (!args[name]) throw new Error(`QA_INPUT_REQUIRED_${name}`);
const trusted = JSON.parse(readFileSync(join(args["--baseline-store"], "qa-trust-registry.json"))).trustedPublicKeys;
const privateKey = createPrivateKey(readFileSync(args["--qa-private-key"]));
const fullSupervisor = args["--full-supervisor"] === "1";
const installedAdapter = args["--installed-adapter"] === "1";
const profiles = [
  { profile: "PHYSICAL_GATEWAY", baselineId: "qa-legacy-gateway-aa57572e8736", baselineName: "gateway-runtime.tar.gz",
    releaseId: args["--gateway-release-id"] || "qa-p38g-gateway-06a65267dffa", releaseName: "gateway-runtime.tar.gz", port: 38191, cloudPort: 38193, suffix: "gateway" },
  { profile: "SOFTWARE_CONNECTOR", baselineId: args["--connector-baseline-id"], baselineName: "connector-legacy-resigned.tar.gz",
    releaseId: args["--connector-release-id"] || "qa-p38g-connector-06a65267dffa", releaseName: "connector-remediation.tar.gz", port: 38192, cloudPort: 38194, suffix: "connector" }
];
const results = [];
function assertSingleOwnedRuntime(port, supervisorPid) {
  const lines = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n");
  assert.equal(lines.length, 2, `port-${port}:one-authoritative-listener`);
  const childPid = Number(lines[1].trim().split(/\s+/)[1]);
  assert.ok(childPid > 1 && supervisorPid > 1);
  const parent = Number(execFileSync("/bin/ps", ["-p", String(childPid), "-o", "ppid="], { encoding: "utf8" }).trim());
  assert.equal(parent, supervisorPid, `port-${port}:supervisor-owns-runtime`);
  return childPid;
}
function release(root, id, name) { const dir = join(root, id), manifest = JSON.parse(readFileSync(join(dir, "release.json")));
  const bytes = readFileSync(join(dir, name));
  assert.equal(verifyEdgeUpdateManifest(manifest, trusted).ok, true, `${id}:signature`);
  assert.equal(verifyEdgeArtifact(bytes, manifest).ok, true, `${id}:digest`);
  return { manifest, bytes }; }
function makeBad({ good, profile, temporary }) {
  const directory = join(temporary, "bad-src"); mkdirSync(directory, { mode: 0o700 });
  const sourcePath = join(temporary, "good.tar.gz"); writeFileSync(sourcePath, good.bytes, { mode: 0o600 });
  execFileSync("tar", ["-xzf", sourcePath, "-C", directory]);
  const prefix = profile === "SOFTWARE_CONNECTOR" ? "Digital Observer.app/Contents/Resources/runtime/" : "";
  const version = "0.3.0-p38g-bad", metadataPath = join(directory, prefix, "edge-release-metadata.json");
  const metadata = JSON.parse(readFileSync(metadataPath)); metadata.version = version;
  writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`);
  writeFileSync(join(directory, prefix, "services/video-gateway/server.mjs"),
    "import http from 'node:http'; http.createServer((_q,r)=>{r.writeHead(503);r.end('QA_HEALTH_FAILURE');}).listen(Number(process.env.PORT),'127.0.0.1');\n");
  if (profile === "SOFTWARE_CONNECTOR") { const app = join(directory, "Digital Observer.app");
    execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", app]);
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]); }
  const archive = join(temporary, "bad.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", directory, profile === "SOFTWARE_CONNECTOR" ? "Digital Observer.app" : "."]);
  const bytes = readFileSync(archive), sha = createHash("sha256").update(bytes).digest("hex");
  const manifest = { ...good.manifest, release_id: `qa-p38g-bad-${profile.toLowerCase()}`, version,
    artifact_url: `https://qa.invalid/${profile.toLowerCase()}/bad.tar.gz`, artifact_sha256: sha,
    artifact_size: bytes.length, released_at: new Date().toISOString(), signature: "" };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), privateKey).toString("base64url");
  assert.equal(verifyEdgeUpdateManifest(manifest, trusted).ok, true);
  return { manifest, bytes };
}

for (const item of profiles) {
  const root = mkdtempSync(join(tmpdir(), `observer-p38g-launchd-${item.suffix}-`));
  const installedSlot = join(root, "installed"), installedRuntime = join(installedSlot, "runtime");
  mkdirSync(installedRuntime, { recursive: true, mode: 0o700 });
  const baseline = release(item.baselineId.startsWith("qa-legacy-connector-resigned")
    ? (args["--connector-baseline-store"] || args["--release-store"]) : args["--baseline-store"], item.baselineId, item.baselineName);
  const remediation = release(args["--release-store"], item.releaseId, item.releaseName);
  const baselinePath = join(root, "baseline.tar.gz"); writeFileSync(baselinePath, baseline.bytes, { mode: 0o600 });
  execFileSync("tar", ["-xzf", baselinePath, "-C", installedRuntime]);
  const persistent = join(root, "persistent"); mkdirSync(persistent, { mode: 0o700 });
  for (const name of ["identity", "config", "durable-queue", "source-map"])
    writeFileSync(join(persistent, name), `QA_${item.profile}_${name}`, { mode: 0o600 });
  let cloud = null;
  if (fullSupervisor) {
    const secrets = join(persistent, "secrets"); mkdirSync(secrets, { mode: 0o700 });
    const cloudUrl = `http://127.0.0.1:${item.cloudPort}`;
    const fixture = { device_gateway_id: randomUUID(), device_observer_site_id: randomUUID(),
      device_private_key_pkcs8: generateManagedDeviceKeyPair().privateKeyPkcs8, device_credential_version: "1",
      device_refresh_token: "qa-isolated-refresh-token-000000000000000000000000000000",
      device_cloud_base_url: cloudUrl };
    for (const [name, value] of Object.entries(fixture)) writeFileSync(join(secrets, name), value, { mode: 0o600 });
    cloud = http.createServer((_request, response) => { response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: { authentication_protocol: "ED25519_V1", access_token: "qa-isolated-token",
        access_expires_at: new Date(Date.now() + 600_000).toISOString(), cameras: [], commands: [] } })); });
    await new Promise(resolve => cloud.listen(item.cloudPort, "127.0.0.1", resolve));
  }
  const label = `com.digitalobserver.qa.${installedAdapter ? "push38h" : "push38g"}.${item.suffix}.${createHash("sha256").update(root).digest("hex").slice(0, 8)}`;
  const legacyAdapter = createQaLaunchdEdgeAdapter({ root, persistentRoot: persistent, installedRoot: installedRuntime,
    label, profile: item.profile, port: item.port, installationId: `qa-${item.suffix}-installation`,
    fullSupervisor, qaCloudUrl: fullSupervisor ? `http://127.0.0.1:${item.cloudPort}` : "" });
  const adapter = installedAdapter ? createMacOSInstalledEdgeAdapter({ profile: item.profile,
    installedBase: installedRuntime, managedRoot: join(root, "ota"), launchAgentPath: join(root, `${label}.plist`),
    label, port: item.port, allowMutations: true, approvedArtifactSha256: baseline.manifest.artifact_sha256,
    trustedPublicKeys: trusted, qaIsolationRoot: root }) : legacyAdapter;
  const device = { deviceId: `qa-${item.suffix}-device`, profile: item.profile, platform: "darwin", architecture: "arm64",
    channel: "INTERNAL", currentVersion: baseline.manifest.version, configVersion: 1, revoked: false };
  const healthCheck = async () => { const probe = await adapter.health({ timeoutMs: 15_000 });
    return { process_running: probe.ok && probe.service.running, device_authenticated: true,
      heartbeat: probe.ok, config_retrieved: true, cloud_reachable: true, no_crash_loop: probe.ok,
      expected_physical_cameras: 0, progressing_physical_cameras: 0, empty_slots: 0, stalled_streams: 0 }; };
  const manager = new EdgeUpdateManager({ root: join(root, "ota"), trustedPublicKeys: trusted, device, adapter, healthCheck });
  if (!installedAdapter) adapter.rememberLegacy({ slot: installedSlot, manifest: baseline.manifest });
  const fixtureFingerprint = () => createHash("sha256").update(["identity", "config", "durable-queue", "source-map"]
    .map(name => readFileSync(join(persistent, name), "utf8")).join("\n")).digest("hex");
  const bootstrap = createInstalledEdgeBootstrap({ root: join(root, "ota"), manager, adapter,
    trust: { verify: async ({ manifest }) => {
      assert.equal(verifyEdgeUpdateManifest(manifest, trusted).ok, true); } },
    inspect: async () => { const observed = await adapter.health({ timeoutMs: 20_000 });
      return { legacy_running: observed.ok, runtime_pid: observed.service.pid,
        runtime_version: observed.body?.edgeRuntime?.software_version || null,
        identity_fingerprint: fixtureFingerprint(), binding_fingerprint: fixtureFingerprint() }; },
    verifyContinuity: async ({ before }) => { const observed = await adapter.health({ timeoutMs: 20_000 });
      return observed.ok && observed.service.pid === before.runtime_pid &&
        (observed.body?.edgeRuntime?.software_version || null) === before.runtime_version &&
        before.identity_fingerprint === fixtureFingerprint(); } });
  try {
    await legacyAdapter.restart({ slot: installedSlot, manifest: baseline.manifest });
    const original = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(original.ok && original.service.running, true, `${item.suffix}:legacy-service-start`);
    if (fullSupervisor) assertSingleOwnedRuntime(item.port, original.service.pid);
    await assert.rejects(bootstrap.run({ manifest: baseline.manifest, artifactBytes: baseline.bytes,
      approvedSha256: "0".repeat(64) }), /EDGE_BOOTSTRAP_BASELINE_MISMATCH/);
    assert.equal((await adapter.health({ timeoutMs: 2000 })).ok, true, `${item.suffix}:wrong-baseline-preserved-runtime`);
    for (const phase of ["DISCOVERED", "BASELINE_AUTHORIZED", "TRUST_VERIFIED", "SLOT_REGISTERED", "SUPERVISOR_HANDOFF"])
      await assert.rejects(bootstrap.run({ manifest: baseline.manifest, artifactBytes: baseline.bytes,
        approvedSha256: baseline.manifest.artifact_sha256, interruptAfter: phase }), /EDGE_BOOTSTRAP_TEST_INTERRUPTION/);
    const boot = await bootstrap.run({ manifest: baseline.manifest, artifactBytes: baseline.bytes,
      approvedSha256: baseline.manifest.artifact_sha256 });
    assert.equal(boot.current_release, item.baselineId);
    assert.equal(boot.known_good_release, item.baselineId);
    assert.equal((await bootstrap.run({ manifest: baseline.manifest, artifactBytes: baseline.bytes,
      approvedSha256: baseline.manifest.artifact_sha256 })).state, "COMPLETE");
    const managedHealth = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(managedHealth.ok, true, `${item.suffix}:baseline-slot-service-start`);
    if (fullSupervisor) assertSingleOwnedRuntime(item.port, managedHealth.service.pid);
    if (args["--abort-after-bootstrap"] === "1") {
      assert.equal((await bootstrap.abort()).state, "UNMANAGED");
      assert.equal(manager.current().slot, null);
      assert.equal(manager.knownGood().length, 0);
      assert.equal((await adapter.health({ timeoutMs: 20_000 })).ok, true, `${item.suffix}:legacy-after-abort`);
      for (const name of ["identity", "config", "durable-queue", "source-map"])
        assert.equal(readFileSync(join(persistent, name), "utf8"), `QA_${item.profile}_${name}`);
      results.push({ profile: item.profile, bootstrap_abort: "PASS", original_runtime_preserved: true,
        management_metadata_removed: true, persistent_fixture_preserved: true });
      continue;
    }
    if (args["--baseline-only"] === "1") {
      results.push({ profile: item.profile, baseline_release: item.baselineId, baseline_sha256: baseline.manifest.artifact_sha256,
        bootstrap: "COMPLETE", journal_resume: "PASS", installed_adapter: installedAdapter,
        full_supervisor: fullSupervisor, identity_config_queue_source_fixtures: "PRESERVED" });
      continue;
    }
    const bad = makeBad({ good: remediation, profile: item.profile, temporary: root });
    const rolledBack = await manager.apply({ manifest: bad.manifest, artifactBytes: bad.bytes });
    assert.equal(rolledBack.state, "ROLLED_BACK", `${item.suffix}:rollback-state`);
    assert.equal(manager.current().release_id, baseline.manifest.release_id);
    manager.verifySlot(manager.current());
    const restored = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(restored.ok && restored.service.running, true, `${item.suffix}:rollback-health`);
    if (fullSupervisor) assertSingleOwnedRuntime(item.port, restored.service.pid);
    const upgraded = await manager.apply({ manifest: remediation.manifest, artifactBytes: remediation.bytes });
    if (upgraded.state !== "HEALTHY") console.error(JSON.stringify({ profile: item.profile,
      upgrade_state: upgraded.state, failure_category: upgraded.failure_category,
      service_error_tail: readFileSync(join(root, "service.err.log"), "utf8").slice(-3000) }));
    assert.equal(upgraded.state, "HEALTHY", `${item.suffix}:upgrade-state`);
    assert.equal(manager.current().release_id, remediation.manifest.release_id);
    const final = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(final.ok && final.service.running, true, `${item.suffix}:remediation-health`);
    assert.equal(final.body.contract, "observer-edge-health-v1");
    assert.equal(final.body.edgeRuntime?.software_version, remediation.manifest.version);
    assert.equal(final.body.edgeRuntime?.build_sha, remediation.manifest.build_sha);
    if (fullSupervisor) assertSingleOwnedRuntime(item.port, final.service.pid);
    for (const name of ["identity", "config", "durable-queue", "source-map"])
      assert.equal(readFileSync(join(persistent, name), "utf8"), `QA_${item.profile}_${name}`);
    results.push({ profile: item.profile, baseline_release: item.baselineId, baseline_sha256: baseline.manifest.artifact_sha256,
      remediation_release: item.releaseId, remediation_sha256: remediation.manifest.artifact_sha256,
      service_manager: "macOS launchd unique QA LaunchAgent", full_supervisor: fullSupervisor, baseline_start: true,
      bad_update_health_failure: true, rollback_restart: true, known_good_integrity: true,
      remediation_upgrade: true, health_contract: final.body.contract, build_sha: final.body.edgeRuntime.build_sha,
      persistent_fixture_preserved: true, live_home_touched: false });
  } finally { legacyAdapter.stop(); if (cloud) await new Promise(resolve => cloud.close(resolve)); rmSync(root, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ status: "ISOLATED_MANAGED_LIFECYCLE_PASS", results }));
