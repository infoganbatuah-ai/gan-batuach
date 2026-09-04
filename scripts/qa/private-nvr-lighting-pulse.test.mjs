import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrivateNvrCommandExecutor, privateNvrPayloadDigest } from "../../services/video-gateway/private-nvr-command-executor.mjs";

const ids = {
  request: "00000000-0000-4000-8000-000000000001",
  confirmation: "00000000-0000-4000-8000-000000000002",
  actor: "00000000-0000-4000-8000-000000000003",
  site: "00000000-0000-4000-8000-000000000004",
  camera: "00000000-0000-4000-8000-000000000005"
};

function fixture(durationMs = 20_000) {
  let clock = Date.parse("2026-09-02T00:00:00.000Z");
  let light = false;
  const writes = [];
  const payload = { enabled: true, duration_ms: durationMs };
  const digest = privateNvrPayloadDigest(payload);
  const requestedAt = new Date(clock).toISOString();
  const expiresAt = new Date(clock + 30_000).toISOString();
  const task = {
    id: ids.request, task_kind: "physical_command", gateway_id: "gateway-a", site_id: ids.site,
    camera_id: ids.camera, stream_id: "stream-a", channel: 1,
    source_generation: "source-1", binding_generation: "binding-1", action: "lighting",
    payload, payload_digest: digest, requested_at: requestedAt, expires_at: expiresAt,
    confirmation: {
      id: ids.confirmation, request_id: ids.request, gateway_id: "gateway-a", site_id: ids.site,
      camera_id: ids.camera, stream_id: "stream-a", channel: 1,
      source_generation: "source-1", binding_generation: "binding-1", action: "lighting",
      payload_digest: digest, actor_id: ids.actor, confirmed_at: requestedAt, expires_at: expiresAt
    }
  };
  const source = () => ({
    kind: "private_nvr_http_mp4", siteId: ids.site, cameraId: ids.camera, streamId: "stream-a", channel: 1,
    generation: "source-1", bindingGeneration: "binding-1", recorderId: "recorder-a",
    mediaProgressing: true, liveVerifiedAt: new Date(clock).toISOString()
  });
  const evidence = () => ({
    adapter: "private_nvr_http_api_v1", gateway_id: "gateway-a", site_id: ids.site,
    camera_id: ids.camera, stream_id: "stream-a", channel: 1,
    source_generation: "source-1", binding_generation: "binding-1",
    verified_at: new Date(clock).toISOString(), light: { tested: true, supported: true }
  });
  const executor = createPrivateNvrCommandExecutor({
    resolveSource: async () => source(), getCapabilityEvidence: async () => evidence(), getSession: async () => ({}),
    refreshSession: async () => ({}), now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
    transport: {
      read: async () => ({ status: 200, payload: { data: { floodlight_switch: light } } }),
      write: async ({ data }) => { light = data.floodlight_switch; writes.push(light); return { status: 200, payload: { result: "success" } }; }
    },
    audit: {
      appendIntent: async (_intent, { intent_digest }) => ({ immutable: true, intent_digest, digest: "a".repeat(64) }),
      verifyReceipt: async () => true
    },
    replay: { reserve: async () => ({ status: "reserved" }), finalize: async () => undefined },
    lease: { acquire: async () => ({ status: "acquired", lease_id: ids.confirmation }), release: async () => undefined }
  });
  return { executor, task, writes, light: () => light, clock: () => clock };
}

test("autonomous lighting is a bounded ON/OFF pulse with read-back", async () => {
  const setup = fixture();
  const result = await setup.executor.execute(setup.task, { gatewayId: "gateway-a", siteId: ids.site });
  assert.deepEqual(setup.writes, [true, false]);
  assert.equal(setup.light(), false);
  assert.equal(setup.clock(), Date.parse("2026-09-02T00:00:20.000Z"));
  assert.equal(result.outcome_payload.executed, true);
  assert.equal(result.outcome_payload.ack_kind, "read_back_state_ack");
});

test("lighting pulse longer than 30 seconds is rejected before a write", async () => {
  const setup = fixture(30_001);
  await assert.rejects(setup.executor.execute(setup.task, { gatewayId: "gateway-a", siteId: ids.site }), /invalid_lighting_duration/);
  assert.deepEqual(setup.writes, []);
});
