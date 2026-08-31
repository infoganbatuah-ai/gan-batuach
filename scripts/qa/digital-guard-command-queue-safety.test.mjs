import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

const siteId = "00000000-0000-4000-8000-000000000001";
const cameraId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const deviceId = "00000000-0000-4000-8000-000000000004";
const body = { action: "result", request_id: requestId, outcome: "command_preflight", result_code: "unavailable",
  outcome_payload: { camera_id: cameraId, site_id: siteId, stream_id: "synthetic-stream", channel: 1,
    action: "lighting", supported: false, ack_kind: "preflight_only", requires_immediate_confirmation: true,
    evidence_id: "00000000-0000-4000-8000-000000000005", verified_at: null, executor_installed: false, executed: false } };

// Real handler and real PostgREST query builder. Transport, authentication and
// data are synthetic; no Supabase project, device, credentials or hardware I/O.
function fixture({ writeError = false, lostClaim = false, foreignGateway = false, actionStatus = "delivered", resultDigest = null, expired = false } = {}) {
  const requests = [], writes = [];
  const source = { id: cameraId, observer_site_id: siteId,
    metadata: { gateway_id: foreignGateway ? "different-gateway" : "synthetic-gateway", gateway_stream_id: "synthetic-stream", dvr_channel: 1 } };
  const db = createClient("https://fixture.invalid", "synthetic-public-key", { auth: { persistSession: false, autoRefreshToken: false },
    global: { async fetch(resource, options) {
      const url = new URL(resource);
      const table = url.pathname.split("/").at(-1);
      const method = options.method;
      requests.push({ table, method, url });
      if (method === "PATCH") {
        assert.equal(table, "digital_observer_camera_action_requests");
        assert.equal(url.searchParams.get("id"), `eq.${requestId}`);
        assert.equal(url.searchParams.get("observer_site_id"), `eq.${siteId}`);
        assert.equal(url.searchParams.get("gateway_id"), "eq.synthetic-gateway");
        assert.equal(url.searchParams.get("action_status"), "eq.delivered");
        assert.match(url.searchParams.get("expires_at"), /^gt\./);
        writes.push(JSON.parse(options.body));
        if (writeError) return Response.json({ message: "synthetic persistence failure", code: "XX000" }, { status: 400 });
        return Response.json(lostClaim ? null : { id: requestId });
      }
      assert.equal(method, "GET");
      assert.equal(url.searchParams.get("observer_site_id"), `eq.${siteId}`);
      if (table === "video_gateway_device_enrollments") {
        assert.equal(url.searchParams.get("id"), `eq.${deviceId}`);
        assert.equal(url.searchParams.get("gateway_id"), "eq.synthetic-gateway");
        assert.equal(url.searchParams.get("status"), "eq.delivered");
        return Response.json({ id: deviceId });
      }
      if (table === "digital_observer_camera_action_requests") return Response.json({
        id: requestId, camera_source_id: cameraId, action_type: "lighting", action_status: actionStatus,
        observer_site_id: siteId, gateway_id: "synthetic-gateway", stream_id: "synthetic-stream", channel: 1,
        task_kind: "command_preflight", payload_digest: "1".repeat(64), result_digest: resultDigest,
        requested_at: new Date(Date.now() - 1000).toISOString(), delivered_at: new Date(Date.now() - 500).toISOString(),
        expires_at: new Date(Date.now() + (expired ? -1000 : 30_000)).toISOString(), source
      });
      if (table === "digital_observer_camera_sources") return Response.json(source);
      throw Error(`Unexpected table ${table}`);
    } }
  });
  const route = loadTs("app/api/video-gateway/camera-actions/route.ts", {
    process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: "synthetic-signing-key" } },
    "@/lib/domain/gateway-device-enrollment": { verifyGatewayDeviceAccessToken(token) {
      return token === "synthetic-device-token" ? { device_id: deviceId, gateway_id: "synthetic-gateway", observer_site_id: siteId } : null;
    } },
    "@/lib/supabase/admin": { createAdminClient() { return db; } }
  });
  return { requests, writes, async post(payload = body, token = "synthetic-device-token") {
    const response = await route.POST(new Request("https://fixture.invalid/api/video-gateway/camera-actions", {
      method: "POST", headers: { "content-type": "application/json", "x-video-gateway-device-token": token }, body: JSON.stringify(payload)
    }));
    return { status: response.status, body: await response.json() };
  } };
}

test("command queue rejects an unauthenticated device before database access", async () => {
  const f = fixture();
  assert.equal((await f.post(body, "invalid-token")).status, 401);
  assert.deepEqual(f.requests, []);
});

test("a scoped preflight result records no physical execution", async () => {
  const f = fixture();
  const result = await f.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.recorded, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].action_status, "completed");
  assert.equal(f.writes[0].result.outcome_payload.executed, false);
  assert.equal(f.writes[0].result.outcome_payload.executor_installed, false);
});

test("failed persistence or a lost delivery claim never returns recorded true", async () => {
  for (const options of [{ writeError: true, expectedStatus: 503 }, { lostClaim: true, expectedStatus: 409 }]) {
    const f = fixture(options);
    const result = await f.post();
    assert.equal(result.status, options.expectedStatus);
    assert.notEqual(result.body.data?.recorded, true);
  }
});

test("preflight-only queue cannot be promoted to physical success by a Gateway", async () => {
  for (const outcome_payload of [undefined, { ...body.outcome_payload, executed: true, executor_installed: true }, body.outcome_payload]) {
    const f = fixture();
    const result = await f.post({ ...body, outcome: "succeeded", outcome_payload });
    assert.equal(result.status, 422);
    assert.deepEqual(f.writes, []);
  }
});

test("preflight evidence requires the exact source, site and literal false execution flags", async () => {
  for (const changes of [{ camera_id: deviceId }, { site_id: deviceId }, { executed: true }, { executed: "false" }, { executor_installed: true }]) {
    const f = fixture();
    assert.equal((await f.post({ ...body, outcome_payload: { ...body.outcome_payload, ...changes } })).status, 422);
    assert.deepEqual(f.writes, []);
  }
});

test("preflight evidence cannot substitute a different stream or DVR channel", async () => {
  for (const changes of [{ stream_id: "different-stream" }, { channel: 2 }, { stream_id: undefined }, { channel: "1" }]) {
    const f = fixture();
    assert.equal((await f.post({ ...body, outcome_payload: { ...body.outcome_payload, ...changes } })).status, 422);
    assert.deepEqual(f.writes, []);
  }
});

test("a device cannot report a result for a source belonging to another Gateway", async () => {
  const f = fixture({ foreignGateway: true });
  assert.equal((await f.post()).status, 403);
  assert.deepEqual(f.writes, []);
});

test("only a delivered action can receive a result", async () => {
  for (const actionStatus of ["approved", "completed", "expired", "awaiting_confirmation"]) {
    const f = fixture({ actionStatus });
    assert.equal((await f.post()).status, 409);
    assert.deepEqual(f.writes, []);
  }
});

test("an identical completed result can be acknowledged again without another write", async () => {
  const { cameraQueueResultSchema, queueResultDigest } = loadTs("lib/domain/digital-observer/camera-queue-contract.ts");
  const f = fixture({ actionStatus: "completed", resultDigest: queueResultDigest(cameraQueueResultSchema.parse(body)) });
  const result = await f.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.recorded, true);
  assert.equal(result.body.data.replay, true);
  assert.deepEqual(f.writes, []);
});

test("a conflicting terminal result never replaces the already recorded result", async () => {
  const f = fixture({ actionStatus: "completed", resultDigest: "0".repeat(64) });
  assert.equal((await f.post()).status, 409);
  assert.deepEqual(f.writes, []);
});

test("an expired delivered diagnostic cannot accept a new result", async () => {
  const f = fixture({ expired: true });
  assert.equal((await f.post()).status, 410);
  assert.deepEqual(f.writes, []);
});
