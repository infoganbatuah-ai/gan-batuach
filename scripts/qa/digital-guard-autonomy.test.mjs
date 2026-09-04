import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const guard = loadTs("lib/domain/digital-observer/guard-engine.ts");
const client = loadTs("lib/domain/digital-observer/guard-command-client.ts");
const now = Date.now();
const siteId = "00000000-0000-4000-8000-000000000001";
const cameraId = "00000000-0000-4000-8000-000000000002";
const policyId = "00000000-0000-4000-8000-000000000003";
const signalId = "00000000-0000-4000-8000-000000000004";
const at = new Date(now).toISOString();
const policy = {
  id: policyId, siteId, cameraId, enabled: true, allowedActions: ["lighting", "siren"],
  lightingEventTypes: ["person_detected", "person_entered"], sirenEventTypes: ["person_entered"],
  minimumConfidence: .9, sirenMinimumConfidence: .95, sirenDurationMs: 1000
};
const decision = (action) => ({
  state: "pending_human_confirmation", allowed: true, dispatch_allowed: false, executed: false,
  camera_source_id: cameraId, site_id: siteId, gateway_id: "gateway-a", stream_id: "stream-a", channel: 1,
  source_generation: "1".repeat(64), binding_generation: "2".repeat(64), evidence_id: signalId, action
});
const event = (changes = {}) => ({
  id: signalId, siteId, cameraId, eventType: "person_entered", evidenceKind: "line_crossing",
  severity: "critical", confidence: .99, occurredAt: at, validated: true, ...changes
});

test("persistent policy authorizes only a fresh, critical, verified line crossing for siren", () => {
  const accepted = guard.authorizeAutonomousGuardAction({
    policy, event: event(), action: "siren", capabilityDecision: decision("siren"), now
  });
  assert.equal(accepted.dispatch_allowed, true);
  for (const changes of [
    { severity: "medium" },
    { evidenceKind: "object_detection" },
    { validated: false },
    { confidence: .94 },
    { occurredAt: new Date(now - 20_001).toISOString() }
  ]) {
    const blocked = guard.authorizeAutonomousGuardAction({
      policy, event: event(changes), action: "siren", capabilityDecision: decision("siren"), now
    });
    assert.equal(blocked.dispatch_allowed, false);
  }
});

test("Digital Guard client queues exact one-second siren through the RPC once", async () => {
  const calls = [];
  const database = {
    rpc: async (name, parameters) => {
      calls.push({ name, parameters });
      return { data: { status: "queued", request_id: cameraId, action: "siren", action_status: "approved" }, error: null };
    }
  };
  const result = await client.requestDigitalGuardCameraAction({
    database, policy, event: event(), action: "siren", payload: { enabled: true, duration_ms: 1000 },
    capabilityDecision: decision("siren"), now
  });
  assert.equal(result.queued, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "enqueue_digital_guard_camera_command_v1");
  assert.equal(calls[0].parameters.signal_id, signalId);
  assert.equal(calls[0].parameters.requested_payload.duration_ms, 1000);
});

test("wrong duration, stale capability and unapproved action never reach the RPC", async () => {
  let calls = 0;
  const database = { rpc: async () => { calls += 1; return { data: null, error: null }; } };
  await assert.rejects(client.requestDigitalGuardCameraAction({
    database, policy, event: event(), action: "siren", payload: { enabled: true, duration_ms: 999 },
    capabilityDecision: decision("siren"), now
  }), /ONE_SECOND/);
  const unavailable = await client.requestDigitalGuardCameraAction({
    database, policy, event: event(), action: "lighting", payload: { enabled: true },
    capabilityDecision: { ...decision("lighting"), allowed: false, state: "blocked", reason: "stale_evidence" }, now
  });
  assert.equal(unavailable.dispatch_allowed, false);
  const restricted = { ...policy, allowedActions: ["lighting"] };
  const noSiren = await client.requestDigitalGuardCameraAction({
    database, policy: restricted, event: event(), action: "siren", payload: { enabled: true, duration_ms: 1000 },
    capabilityDecision: decision("siren"), now
  });
  assert.equal(noSiren.dispatch_allowed, false);
  assert.equal(calls, 0);
});

test("event capability refresh queues only a diagnostic and waits for Gateway evidence", async () => {
  const calls = [];
  let reads = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({
      data: { id: cameraId, action_status: ++reads > 1 ? "completed" : "delivered" },
      error: null
    })
  };
  const database = {
    rpc: async (name, parameters) => {
      calls.push({ name, parameters });
      return { data: { status: "queued", request_id: cameraId, action: "lighting" }, error: null };
    },
    from: table => {
      assert.equal(table, "digital_observer_camera_action_requests");
      return query;
    }
  };
  const result = await client.refreshDigitalGuardCapabilityForEvent({
    database, signalId, action: "lighting", gatewayId: "gateway-a", timeoutMs: 2_000
  });
  assert.equal(result.status, "fresh");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "enqueue_digital_guard_capability_refresh_v1");
  assert.deepEqual(calls[0].parameters, {
    signal_id: signalId, requested_action: "lighting", requested_gateway_id: "gateway-a"
  });
  assert.equal(reads, 2);
});

test("blocked capability refresh never polls or creates a physical command", async () => {
  let reads = 0;
  const database = {
    rpc: async name => {
      assert.equal(name, "enqueue_digital_guard_capability_refresh_v1");
      return { data: { status: "blocked", reason: "outside_active_schedule" }, error: null };
    },
    from: () => { reads += 1; throw new Error("must not poll"); }
  };
  const result = await client.refreshDigitalGuardCapabilityForEvent({
    database, signalId, action: "lighting", gatewayId: "gateway-a"
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "outside_active_schedule");
  assert.equal(reads, 0);
});
