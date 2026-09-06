import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import {
  connectorRuntimeIdentity,
  createInstallationId,
  parseConnectorCommand,
  redactConnectorLog,
  validateConnectorConfigSnapshot
} from "../../services/video-gateway/edge-runtime-contract.mjs";

const root = new URL("../../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const id = "edge-qa-12345678";

test("software and physical deployments share one runtime contract", () => {
  const software = connectorRuntimeIdentity({ OBSERVER_EDGE_DEVICE_TYPE: "SOFTWARE_CONNECTOR", OBSERVER_EDGE_INSTALLATION_ID: id, OBSERVER_EDGE_VERSION: "1.0.0", OBSERVER_EDGE_BUILD_SHA: "abc" });
  const physical = connectorRuntimeIdentity({ OBSERVER_EDGE_DEVICE_TYPE: "PHYSICAL_GATEWAY", OBSERVER_EDGE_INSTALLATION_ID: id, OBSERVER_EDGE_VERSION: "1.0.0", OBSERVER_EDGE_BUILD_SHA: "abc" });
  assert.equal(software.contract, physical.contract);
  assert.equal(software.device_type, "SOFTWARE_CONNECTOR");
  assert.equal(physical.device_type, "PHYSICAL_GATEWAY");
  assert.equal(software.outbound_only, true);
});

test("secure volume keeps identity and credentials private across restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "observer-connector-secrets-"));
  const store = createEdgeSecretStoreSync({ secretDir: directory });
  const installationId = createInstallationId("persistent-test");
  store.write("device_installation_id", installationId);
  store.write("device_refresh_token", "r".repeat(48));
  assert.equal(createEdgeSecretStoreSync({ secretDir: directory }).read("device_installation_id"), installationId);
  assert.equal(statSync(join(directory, "device_refresh_token")).mode & 0o077, 0);
  chmodSync(join(directory, "device_refresh_token"), 0o644);
  assert.throws(() => store.read("device_refresh_token"), /permissions are unsafe/);
});

test("connector command boundary allows operations but never arbitrary shell", () => {
  const now = Date.now();
  const accepted = parseConnectorCommand({ id: "command-health-1234", command: "HEALTH_PROBE", issued_at: new Date(now).toISOString(), expires_at: new Date(now + 30_000).toISOString() });
  assert.equal(accepted.command, "HEALTH_PROBE");
  assert.throws(() => parseConnectorCommand({ ...accepted, command: "RUN_SHELL", shell: "id" }), /CONNECTOR_COMMAND_NOT_ALLOWED|INVALID_CONNECTOR_COMMAND/);
});

test("configuration cache rejects rollback and expired authorization", () => {
  const now = Date.now();
  const current = validateConnectorConfigSnapshot({ version: 3, issued_at: new Date(now).toISOString(), expires_at: new Date(now + 60_000).toISOString(), cameras: [], sampling_policy: { mode: "cloud_managed" } }, 2, now);
  assert.equal(current.version, 3);
  assert.throws(() => validateConnectorConfigSnapshot({ ...current, version: 1 }, 3, now), /ROLLBACK/);
  assert.throws(() => validateConnectorConfigSnapshot({ ...current, expires_at: new Date(now - 1).toISOString() }, 3, now), /EXPIRED/);
});

test("logs redact tokens, credentials and source URLs", () => {
  assert.deepEqual(redactConnectorLog({ device_id: "safe", refresh_token: "secret", nested: { rtsp_url: "rtsp://private", status: "ok" } }), { device_id: "safe", refresh_token: "[redacted]", nested: { rtsp_url: "[redacted]", status: "ok" } });
});

test("enrollment binds an explicit software identity and supports revocation", () => {
  const route = source("app/api/digital-observer/gateway-enrollment/route.ts");
  assert.match(route, /device_type: z\.enum\(\["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"\]\)/);
  assert.match(route, /observer_site_id: site\.id/);
  assert.match(route, /status: "revoked", revoked_at:/);
  assert.match(route, /refresh_token_hash: null/);
});

test("heartbeat is scoped to the enrolled tenant site and reports version", () => {
  const route = source("app/api/video-gateway/device-heartbeat/route.ts");
  for (const required of ["device.device_id", "device.gateway_id", "device.observer_site_id", 'status", "delivered', "software_version", "build_sha", "last_heartbeat_at", "enrolledDeviceType", "installation_id", "idempotent_replay"]) assert.equal(route.includes(required), true);
  assert.match(route, /commands: \[\]/);
});

test("discovery maps through canonical source contract", () => {
  const runner = source("scripts/run-persistent-home-gateway.mjs");
  assert.match(runner, /cloud-discovery/);
  assert.match(runner, /camera_source_id/);
  assert.match(runner, /device_type: edgeDeviceType/);
  assert.match(runner, /software_connector/);
});

test("Docker package is non-root, outbound-only and includes the shared core", () => {
  const dockerfile = source("services/video-gateway/Dockerfile");
  const compose = source("services/video-gateway/docker-compose.software-connector.yml");
  for (const required of ["USER node", "run-software-connector.mjs", "HEALTHCHECK", "services/video-gateway"]) assert.equal(dockerfile.includes(required), true);
  assert.doesNotMatch(compose, /ports:/);
  assert.match(compose, /cap_drop: \["ALL"\]/);
  assert.match(compose, /no-new-privileges:true/);
});

test("installer never prints enrollment or refresh secrets", () => {
  const installer = source("scripts/install-software-connector.mjs");
  assert.match(installer, /credentials_printed: false/);
  assert.doesNotMatch(installer, /console\.log\([^\n]*(poll_token|refresh_token|access_token)/);
  assert.match(installer, /cloud_revocation_required: true/);
});

test("onboarding has a real software connector handoff", () => {
  const wizard = source("components/digital-observer/observer-action-forms.tsx");
  const page = source("app/digital-observer/cameras/connector/page.tsx");
  assert.match(wizard, /cameras\/connector/);
  assert.match(page, /חיבור יוצא בלבד/);
  assert.match(page, /Windows עדיין אינו מסומן כנתמך/);
});

test("core has no office, developer-home or localhost cloud dependency", () => {
  for (const file of ["scripts/run-software-connector.mjs", "scripts/install-software-connector.mjs", "services/video-gateway/edge-runtime-contract.mjs"]) {
    const value = source(file);
    assert.doesNotMatch(value, /(office|\/Users\/|\/Volumes\/|localhost-only|gan-batuach\.vercel\.app)/i);
  }
});

test("local software runtime reports its type and rejects arbitrary command", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "observer-connector-runtime-"));
  const port = 19116;
  const child = spawn(process.execPath, ["services/video-gateway/server.mjs"], {
    cwd: new URL("../../", import.meta.url),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), VIDEO_GATEWAY_SIGNING_SECRET: "qa-signing-secret-1234567890", GAN_BATUACH_GATEWAY_SECRET_DIR: directory, OBSERVER_EDGE_DEVICE_TYPE: "SOFTWARE_CONNECTOR", OBSERVER_EDGE_INSTALLATION_ID: id, OBSERVER_EDGE_VERSION: "qa", OBSERVER_EDGE_BUILD_SHA: "qa-sha" },
    stdio: "ignore"
  });
  context.after(() => child.kill("SIGTERM"));
  let health;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok) { health = await response.json(); break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(health?.edgeRuntime?.device_type, "SOFTWARE_CONNECTOR");
  assert.equal(health?.edgeRuntime?.build_sha, "qa-sha");
  const now = Date.now();
  const valid = await fetch(`http://127.0.0.1:${port}/connector/command`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": "qa-signing-secret-1234567890" }, body: JSON.stringify({ id: "command-health-1234", command: "HEALTH_PROBE", issued_at: new Date(now).toISOString(), expires_at: new Date(now + 30_000).toISOString() }) });
  assert.equal(valid.status, 200);
  const invalid = await fetch(`http://127.0.0.1:${port}/connector/command`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": "qa-signing-secret-1234567890" }, body: JSON.stringify({ id: "command-shell-12345", command: "RUN_SHELL", issued_at: new Date(now).toISOString(), expires_at: new Date(now + 30_000).toISOString() }) });
  assert.equal(invalid.status, 400);
});
