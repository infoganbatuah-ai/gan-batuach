import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const cameraId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const now = new Date().toISOString();

function gateway(payload) {
  const adapter = loadTs("lib/domain/digital-observer/camera-gateway-adapter.ts", {
    process: { env: { DIGITAL_OBSERVER_COMMAND_GATEWAY_URL: "https://gateway.example.invalid", DIGITAL_OBSERVER_COMMAND_GATEWAY_SECRET: "test-only" } },
    fetch: async (_url, options) => ({ ok: true, status: 200, json: async () => payload, options })
  });
  return adapter;
}

test("capability evidence is scoped, live and preserves verified details", async () => {
  const adapter = gateway({ evidence_id: "evidence-1", verified_at: now, gateway_provider: "er-dvr", executor_installed: false,
    manifest: { cameraId, cameraZoneName: "שער", discoveredAt: now, source: "gateway",
      capabilities: { ptz: true, twoWayAudio: false, siren: true, lighting: false },
      details: { ptz: { supported: true, axes: ["pan", "tilt", "zoom"], apiEndpoint: "driver" }, siren: { supported: true } } } });
  const probe = await adapter.probeCameraCapabilities(cameraId);
  assert.equal(probe.gatewayHttpStatus, 200);
  assert.equal(probe.manifest.capabilities.ptz, true);
  assert.equal(probe.manifest.capabilities.lighting, false);
  assert.equal(probe.manifest.raw, undefined);
});

test("command ACK must be HTTP 200, correlated and explicit", async () => {
  const adapter = gateway({ acknowledged: true, command_id: "command-1", request_id: requestId, camera_id: cameraId, state: "executed" });
  const result = await adapter.cameraCommandAdapter().execute({ cameraId, action: "siren", payload: { duration_ms: 3000 }, requestId, expiresAt: new Date(Date.now() + 10_000).toISOString() });
  assert.equal(result.gatewayHttpStatus, 200);
  assert.equal(result.state, "executed");
});

test("a preflight-only response cannot be treated as a physical ACK", async () => {
  const adapter = gateway({ executor_installed: false, preflight: true, status: "ready" });
  await assert.rejects(adapter.cameraCommandAdapter().execute({ cameraId, action: "lighting", payload: { enabled: true }, requestId, expiresAt: new Date(Date.now() + 10_000).toISOString() }), /COMMAND_GATEWAY_ACK_MISSING/);
});
