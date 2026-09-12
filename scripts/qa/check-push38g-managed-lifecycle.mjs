// Full isolated launchd/slot qualification. Unique QA labels and ports only;
// no live LaunchAgent, device identity, camera configuration or Site is used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { createQaLaunchdEdgeAdapter } from "../../services/video-gateway/edge-update-launchd-adapter.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
for (const name of ["--baseline-store", "--release-store", "--qa-private-key", "--connector-baseline-id"])
  if (!args[name]) throw new Error(`QA_INPUT_REQUIRED_${name}`);
const trusted = JSON.parse(readFileSync(join(args["--baseline-store"], "qa-trust-registry.json"))).trustedPublicKeys;
const privateKey = createPrivateKey(readFileSync(args["--qa-private-key"]));
const profiles = [
  { profile: "PHYSICAL_GATEWAY", baselineId: "qa-legacy-gateway-aa57572e8736", baselineName: "gateway-runtime.tar.gz",
    releaseId: "qa-p38g-gateway-06a65267dffa", releaseName: "gateway-runtime.tar.gz", port: 38191, suffix: "gateway" },
  { profile: "SOFTWARE_CONNECTOR", baselineId: args["--connector-baseline-id"], baselineName: "connector-legacy-resigned.tar.gz",
    releaseId: "qa-p38g-connector-06a65267dffa", releaseName: "connector-remediation.tar.gz", port: 38192, suffix: "connector" }
];
const results = [];
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
  const baseline = release(item.baselineId.startsWith("qa-legacy-connector-resigned") ? args["--release-store"] : args["--baseline-store"], item.baselineId, item.baselineName);
  const remediation = release(args["--release-store"], item.releaseId, item.releaseName);
  const baselinePath = join(root, "baseline.tar.gz"); writeFileSync(baselinePath, baseline.bytes, { mode: 0o600 });
  execFileSync("tar", ["-xzf", baselinePath, "-C", installedRuntime]);
  const persistent = join(root, "persistent"); mkdirSync(persistent, { mode: 0o700 });
  for (const name of ["identity", "config", "durable-queue", "source-map"])
    writeFileSync(join(persistent, name), `QA_${item.profile}_${name}`, { mode: 0o600 });
  const label = `com.digitalobserver.qa.push38g.${item.suffix}.${createHash("sha256").update(root).digest("hex").slice(0, 8)}`;
  const adapter = createQaLaunchdEdgeAdapter({ root, persistentRoot: persistent, installedRoot: installedRuntime,
    label, profile: item.profile, port: item.port, installationId: `qa-${item.suffix}-installation` });
  const device = { deviceId: `qa-${item.suffix}-device`, profile: item.profile, platform: "darwin", architecture: "arm64",
    channel: "INTERNAL", currentVersion: baseline.manifest.version, configVersion: 1, revoked: false };
  const healthCheck = async () => { const probe = await adapter.health({ timeoutMs: 15_000 });
    return { process_running: probe.ok && probe.service.running, device_authenticated: true,
      heartbeat: probe.ok, config_retrieved: true, cloud_reachable: true, no_crash_loop: probe.ok,
      expected_physical_cameras: 0, progressing_physical_cameras: 0, empty_slots: 0, stalled_streams: 0 }; };
  const manager = new EdgeUpdateManager({ root: join(root, "ota"), trustedPublicKeys: trusted, device, adapter, healthCheck });
  try {
    await adapter.restart({ slot: installedSlot, manifest: baseline.manifest });
    const original = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(original.ok && original.service.running, true, `${item.suffix}:legacy-service-start`);
    const boot = await manager.bootstrapInstalled({ manifest: baseline.manifest, artifactBytes: baseline.bytes });
    assert.equal(boot.release_id, item.baselineId);
    await adapter.restart({ slot: boot.slot, manifest: baseline.manifest });
    assert.equal((await adapter.health({ timeoutMs: 20_000 })).ok, true, `${item.suffix}:baseline-slot-service-start`);
    const bad = makeBad({ good: remediation, profile: item.profile, temporary: root });
    const rolledBack = await manager.apply({ manifest: bad.manifest, artifactBytes: bad.bytes });
    assert.equal(rolledBack.state, "ROLLED_BACK", `${item.suffix}:rollback-state`);
    assert.equal(manager.current().release_id, baseline.manifest.release_id);
    manager.verifySlot(manager.current());
    const restored = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(restored.ok && restored.service.running, true, `${item.suffix}:rollback-health`);
    const upgraded = await manager.apply({ manifest: remediation.manifest, artifactBytes: remediation.bytes });
    assert.equal(upgraded.state, "HEALTHY", `${item.suffix}:upgrade-state`);
    assert.equal(manager.current().release_id, remediation.manifest.release_id);
    const final = await adapter.health({ timeoutMs: 20_000 });
    assert.equal(final.ok && final.service.running, true, `${item.suffix}:remediation-health`);
    assert.equal(final.body.contract, "observer-edge-health-v1");
    assert.equal(final.body.edgeRuntime?.software_version, remediation.manifest.version);
    assert.equal(final.body.edgeRuntime?.build_sha, remediation.manifest.build_sha);
    for (const name of ["identity", "config", "durable-queue", "source-map"])
      assert.equal(readFileSync(join(persistent, name), "utf8"), `QA_${item.profile}_${name}`);
    results.push({ profile: item.profile, baseline_release: item.baselineId, baseline_sha256: baseline.manifest.artifact_sha256,
      remediation_release: item.releaseId, remediation_sha256: remediation.manifest.artifact_sha256,
      service_manager: "macOS launchd unique QA LaunchAgent", baseline_start: true,
      bad_update_health_failure: true, rollback_restart: true, known_good_integrity: true,
      remediation_upgrade: true, health_contract: final.body.contract, build_sha: final.body.edgeRuntime.build_sha,
      persistent_fixture_preserved: true, live_home_touched: false });
  } finally { adapter.stop(); rmSync(root, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ status: "ISOLATED_MANAGED_LIFECYCLE_PASS", results }));
