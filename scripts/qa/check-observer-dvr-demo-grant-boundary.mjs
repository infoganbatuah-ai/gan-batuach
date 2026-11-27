import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual route module under a closed VM. No database, gateway, secret or network.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/api/digital-observer/dvr-gateway/route.ts");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  assert.equal(BigInt(raw) & 0x40000000n, 0n, "SF_DATALESS source refused");
}
const requireFromRepo = createRequire(resolve(root, "package.json"));
const ts = requireFromRepo("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
});
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
const script = new vm.Script(output.outputText, { filename: file });
const SITE = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const CAMERA = "6fddc732-13df-4268-9f32-3357262ea997";
const plain = (value) => JSON.parse(JSON.stringify(value));
const poison = new Proxy({}, { get() { assert.fail("demo gateway metadata must not be inspected"); } });

function fixture({ sourceMode = "demo", connected = true, access = true, poisonMetadata = false } = {}) {
  const calls = { sourceSelect: [], sourceEq: [], admin: 0, grant: 0, secret: 0, siteAccess: 0 };
  const metadata = poisonMetadata ? poison : { gateway_stream_id: "SYNTHETIC_STREAM", gateway_id: "SYNTHETIC_GATEWAY" };
  const source = { id: CAMERA, observer_site_id: SITE, source_mode: sourceMode,
    status: connected ? "connected" : "offline", health_status: connected ? "healthy" : "offline", metadata };
  const sourceBuilder = {
    select(value) { calls.sourceSelect.push(value); return this; },
    eq(field, value) { calls.sourceEq.push([field, value]); return this; },
    async single() { return { data: source, error: null }; }
  };
  const session = { profile: { id: "owner" }, supabase: { from(table) {
    assert.equal(table, "digital_observer_camera_sources"); return sourceBuilder;
  } } };
  const adminBuilder = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { error: null, data: { lifecycle_state: "ACTIVE", deployment_profile: "PHYSICAL_GATEWAY" } }; }
  };
  const env = new Proxy({ OBSERVER_PLAYBACK_EDGE_ORIGINS_JSON: "{}", NODE_ENV: "development" }, {
    get(target, key) {
      if (key === "VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET") { calls.secret++; return "SYNTHETIC_SECRET"; }
      return Reflect.get(target, key);
    }
  });
  const modules = {
    zod: requireFromRepo("zod"),
    "@/lib/api": { fail: (message, status) => ({ status, error: message }), ok: (data) => ({ status: 200, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/domain/digital-observer/access": {
      getDigitalObserverApiUser: async () => session,
      getObserverSiteAccess: async (_client, _profile, siteId) => { calls.siteAccess++; assert.equal(siteId, SITE); return access ? { id: SITE } : null; }
    },
    "@/lib/domain/digital-observer/dvr-gateway": {
      buildDvrGatewayStatus: () => { assert.fail("GET not allowed in this test"); },
      createDvrPlaybackSession: () => { assert.fail("legacy channel route not allowed"); }
    },
    "@/lib/domain/digital-observer/camera-live-status": { digitalObserverCameraIsConnected: (row) => row.status === "connected" && row.health_status === "healthy" },
    "@/lib/domain/gateway-device-enrollment": { issueGatewayPlaybackGrant: (claim, secret) => {
      calls.grant++; assert.equal(secret, "SYNTHETIC_SECRET");
      assert.equal(claim.camera_source_id, CAMERA); return "SYNTHETIC_GRANT";
    } },
    "@/lib/domain/digital-observer/edge-playback-origin": {
      edgePlaybackOrigin: () => "https://synthetic.invalid", localPlaybackAllowed: () => false
    },
    "@/lib/supabase/admin": { createAdminClient: () => { calls.admin++; return { from(table) {
      assert.equal(table, "video_gateway_device_enrollments"); return adminBuilder;
    } }; } }
  };
  const exports = {};
  script.runInNewContext({ exports, URL, process: { env }, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`);
    return modules[name];
  } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const request = { url: "https://local.invalid/api/digital-observer/dvr-gateway", json: async () => ({ observer_site_id: SITE, camera_source_id: CAMERA, mode: "live" }) };
  return { calls, request, post: () => exports.POST(request) };
}

test("connected demo with Gateway metadata is denied before metadata, secret, admin and grant", async () => {
  const h = fixture({ poisonMetadata: true });
  const result = await h.post();
  assert.deepEqual(plain(result), { status: 404, error: "מקור המצלמה אינו זמין באתר הזה." });
  assert.equal(h.calls.siteAccess, 1);
  assert.match(h.calls.sourceSelect[0], /source_mode/);
  assert.deepEqual(plain(h.calls.sourceEq), [["id", CAMERA], ["observer_site_id", SITE]]);
  assert.equal(h.calls.admin, 0); assert.equal(h.calls.secret, 0); assert.equal(h.calls.grant, 0);
});
test("non-demo connected source preserves the authorized grant contract", async () => {
  const h = fixture({ sourceMode: "gateway_test" });
  const result = await h.post();
  assert.equal(result.status, 200);
  assert.equal(result.data.camera_source_id, CAMERA);
  assert.equal(result.data.status, "authorized");
  assert.equal(result.data.playback.grant, "SYNTHETIC_GRANT");
  assert.equal(result.data.private_source_hidden, true);
  assert.equal(h.calls.admin, 1); assert.equal(h.calls.grant, 1);
});
test("non-demo offline source keeps the existing 409 and cannot issue a grant", async () => {
  const h = fixture({ sourceMode: "live", connected: false });
  const result = await h.post();
  assert.equal(result.status, 409);
  assert.equal(h.calls.admin, 0); assert.equal(h.calls.grant, 0);
});
test("site denial precedes source lookup for demo and non-demo alike", async () => {
  const h = fixture({ access: false });
  const result = await h.post();
  assert.equal(result.status, 403);
  assert.equal(h.calls.sourceSelect.length, 0);
  assert.equal(h.calls.admin, 0); assert.equal(h.calls.grant, 0);
});
