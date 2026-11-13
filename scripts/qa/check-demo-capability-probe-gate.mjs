import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: no gateway, database, network, or credentials.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const routeUrl = new URL("../../app/api/digital-observer/camera-capabilities/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(routeUrl, "utf8"), {
  fileName: routeUrl.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const cameraId = "6fddc732-13df-4268-9f32-3357262ea997";
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";

async function exercise(sourceMode, connectorType, allowed = true) {
  const calls = { probe: 0, update: 0 };
  const source = { id: cameraId, observer_site_id: siteId, display_name: "Synthetic", location_label: "QA",
    capabilities: { ptz: true }, metadata: {}, source_mode: sourceMode, connector_type: connectorType };
  const query = { select() { return query; }, eq() { return query; },
    update() { calls.update++; return query; }, async maybeSingle() { return { data: source, error: null }; } };
  const supabase = { from(table) { assert.equal(table, "digital_observer_camera_sources"); return query; } };
  const manifest = { cameraId, cameraZoneName: "QA", source: "metadata", capabilities: { ptz: true, twoWayAudio: false, siren: false, lighting: false }, details: {}, raw: null };
  const imports = {
    zod: localRequire("zod"),
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: async () => ({ profile: { id: "synthetic" }, supabase }), getObserverSiteAccess: async (_db, _profile, id) => { assert.equal(id, siteId); return allowed ? { id: siteId } : null; } },
    "@/lib/domain/digital-observer/guard-engine": { discoverCameraCapabilities: () => ({ ...manifest }) },
    "@/lib/domain/digital-observer/camera-gateway-adapter": { probeCameraCapabilities: async () => { calls.probe++; return { manifest: { ...manifest, source: "gateway" }, evidenceId: "synthetic-evidence", verifiedAt: new Date().toISOString(), gatewayProvider: "synthetic" }; } }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); }, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const response = await exports.POST({ json: async () => ({ camera_source_id: cameraId }) });
  return { response, calls };
}

const demo = await exercise("demo", "rtsp_gateway");
assert.equal(demo.response.ok, true);
assert.equal(demo.response.data.manifest.source, "simulated");
assert.match(demo.response.data.message, /דמו/);
assert.equal(demo.calls.probe, 0);
assert.equal(demo.calls.update, 0);

const live = await exercise("live", "rtsp_gateway");
assert.equal(live.response.data.manifest.source, "gateway");
assert.equal(live.calls.probe, 1);
assert.equal(live.calls.update, 0);

const anomalous = await exercise("live", "demo");
assert.equal(anomalous.response.data.manifest.source, "metadata");
assert.equal(anomalous.calls.probe, 0);
assert.equal(anomalous.calls.update, 0);

const denied = await exercise("demo", "rtsp_gateway", false);
assert.equal(denied.response.status, 403);
assert.equal(denied.calls.probe, 0);
assert.equal(denied.calls.update, 0);
console.log("demo capability probe gate: closed route tests passed");
