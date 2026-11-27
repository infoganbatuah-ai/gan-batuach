import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic credentials and rows, no Gateway/media/DB/network.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const route = new URL("../../app/api/video-gateway/playback-grant/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(route, "utf8"), {
  fileName: route.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const cameraId = "6fddc732-13df-4268-9f32-3357262ea997";
const gatewayId = "synthetic-gateway";
const streamId = "synthetic-stream";

function load(mode, options = {}) {
  const calls = { audit: 0, tables: [] };
  const queryFor = (table) => {
    let selected = "";
    const query = { select(value) { selected = value; return query; }, eq() { return query; },
      async maybeSingle() {
        if (table === "video_gateway_device_enrollments") return { data: { id: "synthetic-device", lifecycle_state: "ACTIVE", credential_version: 1, deployment_profile: "qa" }, error: null };
        if (table === "digital_observer_camera_sources") {
          assert.ok(selected.split(",").includes("source_mode"));
          return { data: { id: cameraId, observer_site_id: siteId, source_mode: mode,
            metadata: { gateway_id: gatewayId, gateway_stream_id: options.mismatch ? "wrong-stream" : streamId } }, error: null };
        }
        throw Error(`Unexpected table ${table}`);
      },
      async insert() { calls.audit++; return { error: options.replay ? { code: "23505" } : null }; }
    };
    return query;
  };
  const admin = { from(table) { calls.tables.push(table); return queryFor(table); } };
  const imports = {
    zod: localRequire("zod"),
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/domain/gateway-device-enrollment": {
      gatewayDeviceSessionAllows: () => true,
      verifyGatewayDeviceAccessToken: () => ({ gateway_id: gatewayId, observer_site_id: siteId, device_id: "synthetic-device", version: 2, credential_version: 1, deployment_profile: "qa" }),
      verifyGatewayPlaybackGrant: () => ({ gateway_id: gatewayId, observer_site_id: siteId, camera_source_id: cameraId, gateway_stream_id: streamId, nonce: "synthetic-nonce" }) },
    "@/lib/supabase/admin": { createAdminClient: () => admin }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); },
    process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: "synthetic-only" } }, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, calls };
}

async function redeem(mode, options) {
  const loaded = load(mode, options);
  const response = await loaded.post({ headers: { get: () => "synthetic-device-token" }, json: async () => ({ grant: "s".repeat(32) }) });
  return { response, calls: loaded.calls };
}

for (const mode of ["demo", "readiness", "mock", "local_shadow", null]) {
  const result = await redeem(mode);
  assert.equal(result.response.status, 403);
  assert.equal(result.calls.audit, 0);
}
for (const mode of ["live", "gateway_test"]) {
  const result = await redeem(mode);
  assert.equal(result.response.ok, true);
  assert.equal(result.response.data.status, "authorized");
  assert.equal(result.calls.audit, 1);
}
const mismatch = await redeem("live", { mismatch: true });
assert.equal(mismatch.response.status, 403); assert.equal(mismatch.calls.audit, 0);
const replay = await redeem("live", { replay: true });
assert.equal(replay.response.status, 409); assert.equal(replay.calls.audit, 1);
console.log("playback grant source-mode gate: closed route tests passed");
