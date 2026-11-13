import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic queue rows, no database, Gateway, or hardware.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const route = new URL("../../app/api/video-gateway/camera-actions/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(route, "utf8"), {
  fileName: route.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const contract = readFileSync(new URL("../../lib/domain/digital-observer/camera-queue-contract.ts", import.meta.url), "utf8");
assert.match(contract, /cameraQueueSourceSelect\s*=\s*"[^"]*source_mode/);
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const gatewayId = "synthetic-gateway";
const requestId = "a3b8d4cb-46ac-4f64-a999-61a65a39c704";

function load(mode, taskKind = "physical_command") {
  const calls = { blocked: 0, delivered: 0, result: 0, queueTask: 0, selected: [] };
  const row = {
    id: requestId, camera_source_id: "synthetic-camera", observer_site_id: siteId,
    gateway_id: gatewayId, stream_id: "synthetic-stream", channel: 1,
    task_kind: taskKind, action_status: "approved", expires_at: new Date(Date.now() + 30000).toISOString(),
    source: { id: "synthetic-camera", observer_site_id: siteId, source_mode: mode,
      metadata: { gateway_id: gatewayId, gateway_stream_id: "synthetic-stream", dvr_channel: 1 } }
  };
  const db = { from(table) {
    assert.ok(["video_gateway_device_enrollments", "digital_observer_camera_action_requests"].includes(table));
    let updateValue = null;
    const query = {
      select(value) { calls.selected.push(value); return query; }, eq() { return query; }, in() { return query; },
      gt() { return query; }, lte() { return query; }, is() { return query; }, order() { return query; }, limit() { return query; },
      update(value) { updateValue = value; if (value.action_status === "blocked") calls.blocked++; if (value.action_status === "delivered") calls.delivered++; if (value.result_digest) calls.result++; return query; },
      async maybeSingle() {
        if (table === "video_gateway_device_enrollments") return { data: { id: "synthetic-device", lifecycle_state: "ACTIVE", credential_version: 1, deployment_profile: "qa" }, error: null };
        return { data: updateValue ? { id: requestId } : row, error: null };
      },
      then(resolve) { return Promise.resolve({ data: updateValue ? null : [row], error: null }).then(resolve); }
    };
    return query;
  } };
  const queue = {
    cameraQueueKinds: ["capability_snapshot", "command_preflight", "physical_command"],
    cameraQueueRequestSchema: { parse: (value) => value },
    cameraQueueSelect: "synthetic-columns",
    cameraQueueSourceSelect: "source:digital_observer_camera_sources!inner(id,source_mode)",
    PHYSICAL_RESULT_GRACE_MS: 30000,
    queueBindingMatches: (item) => item.source.metadata.gateway_id === gatewayId,
    queueResultDigest: () => "synthetic-digest",
    queueTask: () => { calls.queueTask++; return { id: requestId }; },
    validateQueueResult: () => {}
  };
  const imports = {
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/domain/gateway-device-enrollment": { gatewayDeviceSessionAllows: () => true, verifyGatewayDeviceAccessToken: () => ({ device_id: "synthetic-device", gateway_id: gatewayId, observer_site_id: siteId, version: 2, credential_version: 1, deployment_profile: "qa" }) },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/domain/digital-observer/camera-queue-contract": queue
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); },
    process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: "synthetic-only" } }, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, row, calls };
}

async function send(loaded, payload) {
  return loaded.post({ headers: { get: () => "synthetic-device-token" }, json: async () => payload });
}
for (const mode of ["demo", "readiness", "mock", null]) {
  const loaded = load(mode);
  const response = await send(loaded, { action: "poll" });
  assert.equal(response.data.action_request, null);
  assert.equal(loaded.calls.blocked, 1);
  assert.equal(loaded.calls.delivered, 0);
  assert.equal(loaded.calls.queueTask, 0);
  assert.ok(loaded.calls.selected.some((value) => String(value).includes("source_mode")));
}
for (const mode of ["live", "gateway_test"]) {
  const loaded = load(mode);
  const response = await send(loaded, { action: "poll" });
  assert.equal(response.data.action_request.id, requestId);
  assert.equal(loaded.calls.delivered, 1);
  assert.equal(loaded.calls.blocked, 0);
}
const reported = load("demo");
reported.row.action_status = "delivered";
const result = await send(reported, { action: "result", request_id: requestId, outcome: "physical_command", outcome_payload: {} });
assert.equal(result.data.recorded, true);
assert.equal(reported.calls.result, 1);
const legacy = load("demo", "legacy_command");
legacy.row.action_status = "delivered";
const legacyResult = await send(legacy, { action: "result", request_id: requestId, outcome: "failed", outcome_payload: {} });
assert.equal(legacyResult.data.recorded, true);
console.log("physical queue source-mode delivery: closed route tests passed");
