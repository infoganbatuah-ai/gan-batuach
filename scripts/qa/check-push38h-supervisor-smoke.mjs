// Actual installed supervisor scripts under isolated QA LaunchAgents. No live
// service label, camera credentials, Site or private identity is read.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateManagedDeviceKeyPair } from "../../services/video-gateway/managed-device-auth.mjs";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQaLaunchdEdgeAdapter } from "../../services/video-gateway/edge-update-launchd-adapter.mjs";

const [baselineStore, releaseStore] = process.argv.slice(2);
if (!baselineStore || !releaseStore) throw new Error("QA_RELEASE_STORES_REQUIRED");
const cases = [
  { name: "gateway", profile: "PHYSICAL_GATEWAY", id: "qa-legacy-gateway-aa57572e8736",
    archive: "gateway-runtime.tar.gz", store: baselineStore, port: 38201, cloudPort: 38211 },
  { name: "connector", profile: "SOFTWARE_CONNECTOR", id: "qa-legacy-connector-resigned-6e7988808b05",
    archive: "connector-legacy-resigned.tar.gz", store: releaseStore, port: 38202, cloudPort: 38212 }
];
const results = [];
for (const item of cases) {
  const root = mkdtempSync(join(tmpdir(), `observer-p38h-supervisor-${item.name}-`));
  const runtime = join(root, "installed", "runtime"), persistent = join(root, "persistent"), secrets = join(persistent, "secrets");
  mkdirSync(runtime, { recursive: true, mode: 0o700 }); mkdirSync(secrets, { recursive: true, mode: 0o700 });
  const releaseRoot = join(item.store, item.id);
  const manifest = JSON.parse(readFileSync(join(releaseRoot, "release.json")));
  execFileSync("tar", ["-xzf", join(releaseRoot, item.archive), "-C", runtime]);
  const server = http.createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ data: { authentication_protocol: "ED25519_V1", access_token: "qa-isolated-token",
      access_expires_at: new Date(Date.now() + 600_000).toISOString(), cameras: [], commands: [] } }));
  });
  await new Promise(resolve => server.listen(item.cloudPort, "127.0.0.1", resolve));
  const cloudUrl = `http://127.0.0.1:${item.cloudPort}`;
  const key = generateManagedDeviceKeyPair();
  const fixture = {
    device_gateway_id: randomUUID(), device_observer_site_id: randomUUID(),
    device_private_key_pkcs8: key.privateKeyPkcs8, device_credential_version: "1",
    device_refresh_token: "qa-isolated-refresh-token-000000000000000000000000000000",
    device_cloud_base_url: cloudUrl
  };
  for (const [name, value] of Object.entries(fixture)) writeFileSync(join(secrets, name), value, { mode: 0o600 });
  const adapter = createQaLaunchdEdgeAdapter({ root, label: `com.digitalobserver.qa.push38g.p38h.${item.name}`,
    profile: item.profile, port: item.port, persistentRoot: persistent, installedRoot: runtime,
    installationId: `qa-p38h-${item.name}`, fullSupervisor: true, qaCloudUrl: cloudUrl });
  try {
    await adapter.restart({ slot: join(root, "installed"), manifest });
    const health = await adapter.health({ timeoutMs: 25_000 });
    assert.equal(health.ok && health.service.running, true, `${item.name}:full-supervisor-start`);
    assert.equal(health.body.edgeRuntime?.device_type, item.profile);
    const crashRecoveryMs = [];
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const before = adapter.status();
      assert.equal(before.running, true);
      assert.ok(before.pid && before.pid > 1);
      const started = Date.now();
      process.kill(before.pid, "SIGKILL");
      let recovered = false;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const state = adapter.status();
        if (state.running && state.pid && state.pid !== before.pid && (await adapter.health({ timeoutMs: 1000 })).ok) {
          recovered = true; break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      assert.equal(recovered, true, `${item.name}:launchd-crash-recovery-${cycle}`);
      crashRecoveryMs.push(Date.now() - started);
    }
    await adapter.restart({ slot: join(root, "installed"), manifest });
    const restarted = await adapter.health({ timeoutMs: 25_000 });
    assert.equal(restarted.ok && restarted.service.running, true, `${item.name}:full-supervisor-restart`);
    for (const [name, value] of Object.entries(fixture)) assert.equal(readFileSync(join(secrets, name), "utf8"), value);
    results.push({ profile: item.profile, full_supervisor_script: true, launchd_start: true,
      launchd_restart: true, forced_supervisor_crash_recovered: true, crash_recovery_ms: crashRecoveryMs,
      local_fixture_identity_unchanged: true, cloud_fixture_only: true, physical_cameras: 0 });
  } finally { adapter.stop(); await new Promise(resolve => server.close(resolve)); rmSync(root, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ status: "ISOLATED_FULL_SUPERVISOR_SMOKE_PASS", results }));
