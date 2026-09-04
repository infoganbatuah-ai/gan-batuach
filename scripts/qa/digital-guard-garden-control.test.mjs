import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const cameraId = "00000000-0000-4000-8000-000000000001";
const gardenId = "00000000-0000-4000-8000-000000000003";

// Actual garden handler and command policy; only auth, persistence and hardware
// boundaries are replaced. No device, network or real audit record is touched.
function gardenRoute({ foreign = false, demo = false, claimError, outcomeError = false, gateway = true, lostReply = false } = {}) {
  const calls = [], audits = [], claims = new Set();
  const camera = { id: cameraId, garden_id: foreign ? "foreign-garden" : gardenId,
    name: demo ? "[DEMO] שער" : "שער", status: "connected", health_status: "healthy" };
  const database = { from(table) {
    assert.equal(table, "camera_streams");
    const filters = [];
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() {
        assert.deepEqual(filters, [["id", cameraId], ["garden_id", gardenId]]);
        calls.push("camera-read");
        return { data: filters.every(([key, value]) => camera[key] === value) ? camera : null, error: null };
      } };
    return query;
  } };
  const adapter = { async execute(command) {
    calls.push("execute");
    assert.equal(command.cameraId, cameraId);
    assert.equal(command.action, "lighting");
    assert.deepEqual(command.payload, { enabled: true });
    if (lostReply) throw Error("synthetic response lost");
    return { acknowledged: true, commandId: "synthetic-command", state: "executed" };
  } };
  const route = loadTs("app/api/camera-streams/[id]/commands/route.ts", {
    "@/lib/auth": { async requireRole(roles) {
      assert.deepEqual(roles, ["manager", "owner"]); calls.push("role");
      return { profile: { id: "manager", role: "manager", garden_id: gardenId } };
    } },
    "@/lib/supabase/server": { async createClient() { return database; } },
    "@/lib/supabase/admin": { createAdminClient() { return { from(table) {
      assert.equal(table, "immutable_audit_events");
      return { async insert(row) {
        assert.equal(row.garden_id, gardenId); assert.equal(row.camera_id, cameraId);
        assert.equal(row.actor_profile_id, "manager");
        const intent = row.event_type === "camera_command_dispatch_intent";
        calls.push(intent ? "claim" : "outcome");
        if (intent) {
          assert.equal(row.id, row.request_id);
          assert.match(row.metadata.payload_digest, /^[a-f0-9]{64}$/);
          assert.equal(row.metadata.payload, undefined);
          if (claimError) return { error: claimError };
          if (claims.has(row.id)) return { error: { code: "23505" } };
          claims.add(row.id);
        } else if (outcomeError) return { error: { code: "synthetic-failure" } };
        audits.push(row);
        return { error: null };
      } };
    } }; } },
    "@/lib/domain/digital-observer/camera-gateway-adapter": {
      cameraCommandAdapter() { calls.push("adapter"); return gateway ? adapter : null; },
      async probeCameraCapabilities(id) {
        assert.equal(id, cameraId); calls.push("probe");
        const at = new Date().toISOString();
        return { manifest: { cameraId, cameraZoneName: "שער", discoveredAt: at, source: "gateway",
          capabilities: { ptz: false, twoWayAudio: false, siren: false, lighting: true } },
        evidenceId: "synthetic-proof", gatewayProvider: "synthetic", verifiedAt: at };
      }
    }
  });
  return { calls, audits, async post(requestId = randomUUID(), changes = {}) {
    const body = { camera_stream_id: cameraId, request_id: requestId, requested_at: new Date().toISOString(), confirmed: true,
      action: "lighting", payload: { enabled: true }, ...changes };
    const response = await route.POST(new Request(`http://localhost/api/camera-streams/${cameraId}/commands`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    }), { params: Promise.resolve({ id: cameraId }) });
    return { status: response.status, body: await response.json() };
  } };
}

test("garden handler scopes camera reads to the authenticated garden before any gateway access", async () => {
  const p = gardenRoute({ foreign: true });
  assert.equal((await p.post()).status, 404);
  assert.deepEqual(p.calls, ["role", "camera-read"]);
});

test("garden demo never constructs an adapter, sends a command or claims durable audit", async () => {
  const p = gardenRoute({ demo: true });
  const result = await p.post();
  assert.equal(result.body.data.simulated, true);
  assert.equal(result.body.data.executed, null);
  assert.equal(result.body.data.audit_recorded, false);
  assert.deepEqual(p.calls, ["role", "camera-read"]);
});

test("garden handler normalizes its camera ID and records a scoped durable intent before dispatch", async () => {
  const p = gardenRoute();
  const result = await p.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.executed, true);
  assert.deepEqual(p.calls, ["role", "camera-read", "adapter", "probe", "claim", "execute", "outcome"]);
  assert.equal(p.audits.length, 2);
});

test("garden audit unavailability and duplicate claim both prevent sending", async () => {
  for (const [code, status] of [["synthetic-failure", 503], ["23505", 409]]) {
    const p = gardenRoute({ claimError: { code } });
    assert.equal((await p.post()).status, status);
    assert.ok(!p.calls.includes("execute"));
  }
});

test("concurrent garden requests with the same ID dispatch at most once", async () => {
  const p = gardenRoute();
  const id = randomUUID();
  const results = await Promise.all([p.post(id), p.post(id)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(p.calls.filter((call) => call === "execute").length, 1);
});

test("garden post-send audit failure preserves confirmed execution and flags the audit failure", async () => {
  const p = gardenRoute({ outcomeError: true });
  const result = await p.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.executed, true);
  assert.equal(result.body.data.audit_recorded, false);
});

test("garden lost reply is unknown, not successful execution, and is not retried", async () => {
  const p = gardenRoute({ lostReply: true });
  const result = await p.post();
  assert.equal(result.status, 202);
  assert.equal(result.body.data.state, "outcome_unknown");
  assert.equal(result.body.data.executed, null);
  assert.equal(p.calls.filter((call) => call === "execute").length, 1);
});

test("garden missing gateway, mismatched ID and missing confirmation cannot dispatch", async () => {
  const p = gardenRoute({ gateway: false });
  assert.equal((await p.post()).status, 503);
  assert.ok(!p.calls.includes("probe"));
  for (const [changes, status] of [[{ camera_stream_id: randomUUID() }, 409], [{ confirmed: false }, 422]]) {
    const rejected = gardenRoute();
    assert.equal((await rejected.post(randomUUID(), changes)).status, status);
    assert.deepEqual(rejected.calls, ["role"]);
  }
});
