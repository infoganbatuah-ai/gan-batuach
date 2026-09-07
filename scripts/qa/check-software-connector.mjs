import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { createEventEvidenceStore, evidencePlaylist } from "../../services/video-gateway/event-evidence-store.mjs";
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
  const gatewayDomain = source("lib/domain/video-gateway.ts");
  assert.match(runner, /cloud-discovery/);
  assert.match(runner, /camera_source_id/);
  assert.match(runner, /device_type: edgeDeviceType/);
  assert.match(runner, /software_connector/);
  assert.match(gatewayDomain, /connection_type: z\.enum\(\["dvr", "nvr", "onvif", "rtsp"\]\)\.default\("dvr"\)/);
  assert.match(gatewayDomain, /edgeDeviceType\?: "SOFTWARE_CONNECTOR" \| "PHYSICAL_GATEWAY"/);
  assert.match(gatewayDomain, /softwareConnectorAvailable: softwareConnector/);
  assert.match(gatewayDomain, /physicalGatewayAvailable: !softwareConnector && values\.gatewayConfigured/);
  assert.match(gatewayDomain, /connector_transport: softwareConnector \? "software_connector" : "gateway"/);
  assert.match(gatewayDomain, /connector_device_type: values\.edgeDeviceType \?\? "PHYSICAL_GATEWAY"/);
  assert.match(gatewayDomain, /edgeDeviceType,/);
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
  const productFlow = source("components/digital-observer/software-connector-onboarding.tsx");
  const route = source("app/api/digital-observer/software-connector/route.ts");
  assert.match(wizard, /cameras\/connector/);
  assert.match(page, /חיבור יוצא בלבד/);
  assert.match(page, /חבילות macOS ו‑Windows/);
  assert.match(page, /SoftwareConnectorOnboarding/);
  assert.match(productFlow, /type="password"/);
  assert.match(productFlow, /פרטי התחברות למצלמות שנבחרו/);
  assert.match(productFlow, /configure_batch/);
  assert.match(productFlow, /activate_batch/);
  assert.match(productFlow, /בחר הכול/);
  assert.match(productFlow, /autoCapitalize="none"/);
  assert.match(productFlow, /lang="en"/);
  assert.match(productFlow, /סיסמת מצלמה/);
  assert.doesNotMatch(productFlow, /showCredentials/);
  assert.match(route, /encryptField\(payload\.username\)/);
  assert.match(route, /encryptField\(payload\.password\)/);
  assert.match(route, /credentials_local_delivery_pending/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)\([^\n]*(?:payload\.password|payload\.username)/);
});

test("software connector uses an isolated port, owner lock and stream namespace", () => {
  const wrapper = source("scripts/run-software-connector.mjs");
  const runner = source("scripts/run-persistent-home-gateway.mjs");
  assert.match(wrapper, /VIDEO_GATEWAY_PORT \|\|= "18083"/);
  assert.match(wrapper, /GAN_BATUACH_JOURNAL_OWNER_LOCK_PATH/);
  assert.match(wrapper, /connector_stream_namespace/);
  assert.match(runner, /gatewayPort/);
  assert.match(runner, /connectionType/);
});

test("generic RTSP discovery registers a relay source instead of probe-only readiness", () => {
  const gateway = source("services/video-gateway/server.mjs");
  const inference = source("services/video-gateway/object-inference-client.mjs");
  assert.match(gateway, /kind: "rtsp"/);
  assert.match(gateway, /directRtsp/);
  assert.match(gateway, /-rtsp_transport/);
  assert.match(gateway, /controller\?\.abort\(\)/);
  assert.match(gateway, /relay\.process\.stdin\?\.writableNeedDrain/);
  assert.match(inference, /VIDEO_GATEWAY_OBJECT_WORKER_PATH/);
});

test("high-bitrate RTSP playback history keeps only the bounded event prebuffer", () => {
  const segmentBytes = Buffer.alloc(1024 * 1024, 7);
  const segments = Array.from({ length: 12 }, (_, index) => ({
    name: `segment-${String(index).padStart(6, "0")}.ts`,
    sequence: index,
    discontinuity: 0,
    duration_seconds: 1
  }));
  const store = createEventEvidenceStore();
  store.updateManifest({ monitoring_enabled: true, observer_site_id: "site-safe", gateway_id: "gateway-safe", cameras: [{
    stream_id: "rtsp-safe", camera_id: "camera-safe", monitoring_enabled: true, object_analysis_enabled: true,
    status: "connected", zone_type: "OTHER", supported_event_types: ["person_detected"],
    allowed_event_types: ["person_detected"], verified_event_types: ["person_detected"]
  }] });
  const prepared = store.prepare({ streamId: "rtsp-safe", sourceGeneration: "generation-safe", sequenceFloor: 0,
    playlistText: evidencePlaylist(segments, false), readSegment: () => segmentBytes });
  assert.equal(prepared.status, "prepared");
  assert.equal(store.status().retained_bytes, 4 * 1024 * 1024);
  store.release(prepared.lease_id);
});

test("connector cloud handoff keeps camera secrets out of files and logs", () => {
  const cloud = source("services/video-gateway/software-connector-cloud.mjs");
  const discovery = source("scripts/discover-software-connector-cameras.mjs");
  assert.match(cloud, /store\.write\("dvr_profile_json"/);
  assert.match(cloud, /store\.write\("dvr_password"/);
  assert.doesNotMatch(cloud + discovery, /console\.log\([^\n]*(?:camera\.password|camera\.username|camera\.endpoint)/);
  assert.match(discovery, /private_addresses_printed: false/);
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
