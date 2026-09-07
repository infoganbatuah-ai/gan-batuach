import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { digitalObserverCameraHealthProjection, digitalObserverCameraOperationalState } from "../../lib/domain/digital-observer/camera-live-status.ts";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("managed edge entry points install the maintained HTTP runtime", async () => {
  const dependencyVersion = require("undici/package.json").version;
  assert.equal(dependencyVersion, "8.10.2");
  assert.match(read("services/video-gateway/server.mjs"), /import "\.\/http-runtime\.mjs"/);
  assert.match(read("scripts/run-persistent-home-gateway.mjs"), /import "\.\.\/services\/video-gateway\/http-runtime\.mjs"/);
  assert.match(read("scripts/install-persistent-home-gateway.mjs"), /node_modules", "undici"/);
  assert.match(read("scripts/install-persistent-home-gateway.mjs"), /OBSERVER_EDGE_CHANNELS/);
  assert.match(read("scripts/run-persistent-home-gateway.mjs"), /Cloud request failed \(\$\{response\.status\}:\$\{category\}\)/);
  const runtime = await import("../../services/video-gateway/http-runtime.mjs");
  assert.deepEqual(runtime.edgeHttpRuntimeStatus(), {
    provider: "undici-package",
    version: "8.10.2",
    bundledNodeVersion: process.versions.undici || null,
    typeOfServiceCrashGuard: true
  });
});

test("empty DVR slots are unassigned and never offline failures", () => {
  const row = { status: "offline", health_status: "failed", metadata: { channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false } };
  assert.equal(digitalObserverCameraOperationalState(row), "CHANNEL_EMPTY");
  assert.deepEqual(digitalObserverCameraHealthProjection(row), { operationalState: "CHANNEL_EMPTY", status: "unassigned", healthStatus: "unknown", live: false });
});

test("fresh connected sources are online while stale rows fail closed", () => {
  const now = Date.parse("2026-09-08T00:00:00.000Z");
  const base = { status: "connected", health_status: "healthy", gateway_stream_id: "stream-1", metadata: {} };
  assert.equal(digitalObserverCameraOperationalState({ ...base, last_seen_at: "2026-09-07T23:30:00.000Z" }, { now }), "ONLINE");
  assert.equal(digitalObserverCameraOperationalState({ ...base, last_seen_at: "2026-09-07T22:50:00.000Z" }, { now }), "RECOVERING");
  assert.equal(digitalObserverCameraOperationalState({ ...base, last_seen_at: "2026-09-07T22:20:00.000Z" }, { now }), "OFFLINE");
  assert.equal(digitalObserverCameraOperationalState(base, { now }), "OFFLINE");
});

test("legacy auth route does not disguise database/schema failure as 401", () => {
  const route = read("app/api/digital-observer/gateway-enrollment/route.ts");
  assert.match(route, /if \(enrollment\.error\) \{[\s\S]*DATABASE_SCHEMA_OR_QUERY[\s\S]*503/);
  assert.match(route, /if \(!enrollment\.data \|\| enrollment\.data\.identity_scheme !== "LEGACY_HMAC"/);
});

test("cloud discovery and learning accept scoped managed-device operations", () => {
  const identity = read("lib/domain/digital-observer/managed-device-identity.ts");
  const learning = read("app/api/video-gateway/cloud-learning/route.ts");
  assert.match(identity, /"DISCOVERY_PUBLISH", "LEARNING_PUBLISH"/);
  assert.match(learning, /gatewayDeviceSessionAllows\(candidateDevice, "LEARNING_PUBLISH"\)/);
  assert.match(learning, /payload\.observer_site_id !== device\.observer_site_id/);
  assert.match(learning, /device\.deployment_profile !== enrolled\.data\.deployment_profile/);
});

test("cloud rediscovery reuses the stable Site, Gateway and channel source", () => {
  const domain = read("lib/domain/video-gateway.ts");
  assert.match(domain, /contains\("metadata", \{ gateway_id: values\.gatewayId, dvr_channel: values\.channel \}\)/);
  assert.match(domain, /DUPLICATE_GATEWAY_CHANNEL_SOURCE/);
  assert.match(domain, /if \(byStableChannel\.data\?\.\[0\]\) existing = \{ data: byStableChannel\.data\[0\] \}/);
});
