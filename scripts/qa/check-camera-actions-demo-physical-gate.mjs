import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed, synthetic route harness. No database, network, credentials, or physical action.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const route = new URL("../../app/api/digital-observer/camera-actions/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(route, "utf8"), {
  fileName: route.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const cameraId = "6fddc732-13df-4268-9f32-3357262ea997";
const requestId = "a3b8d4cb-46ac-4f64-a999-61a65a39c704";
const gatewayId = "gateway_synthetic";
const streamId = "stream_synthetic";

function harness(mode) {
  const calls = { tables: [], inserts: 0, rpc: 0, snapshotReads: 0 };
  const source = { id: cameraId, observer_site_id: siteId, source_mode: mode,
    status: "connected", health_status: "healthy",
    metadata: { gateway_id: gatewayId, gateway_stream_id: streamId, dvr_channel: 1 } };
  const snapshot = { id: requestId, result: { reported_by_gateway: true, outcome: "capability_snapshot",
    outcome_payload: { site_id: siteId, camera_id: cameraId, gateway_id: gatewayId, stream_id: streamId, channel: 1,
      executor_installed: true, capabilities: { lighting: true, siren: false, ptz: false }, live: true,
      source_generation: "one", binding_generation: "one", evidence_id: requestId, verified_at: new Date().toISOString(), driver: "synthetic" } } };
  const admin = {
    from(table) {
      calls.tables.push(table);
      if (table === "digital_observer_camera_action_requests") calls.snapshotReads++;
      let selected = "";
      const query = {
        select(columns) { selected = columns; if (table === "digital_observer_camera_sources") assert.ok(columns.split(",").includes("source_mode")); return query; },
        eq() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; },
        insert() { calls.inserts++; return query; },
        async maybeSingle() {
          if (table === "digital_observer_camera_sources") return { data: source, error: null };
          if (table === "digital_observer_camera_action_requests") return { data: selected.includes("requested_by")
            ? { id: requestId, camera_source_id: cameraId, observer_site_id: siteId, requested_by: "synthetic-user", task_kind: "physical_command", action_status: "awaiting_confirmation", expires_at: new Date(Date.now() + 30000).toISOString() }
            : snapshot, error: null };
          if (table === "digital_observer_camera_automation_policies") return { data: null, error: null };
          throw Error(`Unexpected table ${table}`);
        },
        async single() { return { data: { id: requestId, expires_at: new Date(Date.now() + 30000).toISOString() }, error: null }; }
      };
      return query;
    },
    rpc() { calls.rpc++; throw Error("No physical RPC permitted in closed harness"); }
  };
  const imports = {
    "node:crypto": localRequire("node:crypto"), zod: localRequire("zod"),
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: async () => ({ profile: { id: "synthetic-user" }, supabase: {} }),
      getObserverSiteAccess: async (_db, _profile, id, rights) => { assert.equal(id, siteId); assert.equal(rights.manage, true); return { id: siteId }; } },
    "@/lib/domain/digital-observer/camera-queue-contract": {
      PHYSICAL_COMMAND_TTL_MS: 30000,
      allowedPhysicalControls: (value) => value?.outcome_payload?.capabilities?.lighting === true ? ["lighting"] : [],
      physicalPayloadDigest: () => ({ payload: { enabled: true }, digest: "synthetic-digest" }) },
    "@/lib/supabase/admin": { createAdminClient: () => admin }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); }, Date, fetch() { throw Error("Network forbidden"); } },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, calls };
}

async function post(mode, payload) {
  const { post: routePost, calls } = harness(mode);
  const response = await routePost({ json: async () => payload });
  return { response, calls };
}

for (const action of ["controls", "prepare"]) {
  const payload = action === "controls" ? { action, camera_source_id: cameraId }
    : { action, request_id: requestId, camera_source_id: cameraId, camera_action: "lighting", payload: { enabled: true } };
  const demo = await post("demo", payload);
  assert.equal(demo.response.status, 404);
  assert.deepEqual(demo.calls.tables, ["digital_observer_camera_sources"]);
  assert.equal(demo.calls.inserts, 0);
  assert.equal(demo.calls.rpc, 0);
  assert.equal(demo.calls.snapshotReads, 0);
  const live = await post("live", payload);
  assert.equal(live.response.ok, true);
  if (action === "controls") assert.equal(live.response.data.controls[0], "lighting");
  else { assert.equal(live.response.data.prepared, true); assert.equal(live.calls.inserts, 1); }
  assert.equal(live.calls.rpc, 0);
}

const confirmation = await post("demo", { action: "confirm", request_id: requestId,
  confirmation_id: requestId, confirmation_nonce: "a".repeat(32) });
assert.equal(confirmation.response.status, 404);
assert.equal(confirmation.calls.rpc, 0);

console.log("camera actions demo physical gate: closed route tests passed");
