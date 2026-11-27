import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic metadata, no Gateway, database, or network.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const route = new URL("../../app/api/video-gateway/event-manifest/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(route, "utf8"), {
  fileName: route.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const gatewayId = "synthetic-gateway";
const camera = (id, mode, gateway = gatewayId) => ({ id, display_name: id, status: "connected", source_mode: mode,
  metadata: { gateway_id: gateway, gateway_stream_id: `stream-${id}`, channel_assignment: "ASSIGNED", physical_camera_attached: true, monitoring_enabled: true }, capabilities: {} });
const sources = [camera("demo", "demo"), camera("readiness", "readiness"), camera("mock", "mock"),
  camera("shadow", "local_shadow"), camera("unset", null), camera("live", "live"), camera("test", "gateway_test"), camera("wrong-gateway", "live", "other")];

function load(authorized = true) {
  const calls = { sourceReads: 0, audit: 0 };
  const db = { from(table) {
    const query = { select() { return query; }, eq() { return query; }, in() { return query; },
      async single() { if (table !== "observer_sites") throw Error(`Unexpected single ${table}`);
        return { data: { id: siteId, garden_id: null, site_type: "home", monitoring_enabled: true,
          vision_privacy_mode: "standard", business_handles_children: false, metadata: { observer_monitoring_consent: true } }, error: null }; },
      async maybeSingle() { return { data: null, error: null }; },
      async insert() { calls.audit++; return { error: null }; },
      then(resolve) { if (table === "digital_observer_camera_sources") calls.sourceReads++;
        return Promise.resolve({ data: table === "digital_observer_camera_sources" ? sources : [], error: null }).then(resolve); }
    };
    return query;
  } };
  const imports = {
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/domain/event-engine/gateway-auth": { authenticateEventGateway: async () => authorized ? { observer_site_id: siteId, gateway_id: gatewayId } : null,
      eventEnvironmentFingerprint: () => "synthetic-fingerprint" },
    "@/lib/domain/event-engine/camera-zone-mapper": { cameraZoneMapper: { map: (row) => ({ camera_id: row.id, zone_type: "entry", source: "default" }) }, validCrossingLine: () => false },
    "@/lib/domain/event-engine/event-validation-pipeline": { CONTEXT_RULES_MATRIX: { entry: [] } },
    "@/lib/domain/digital-observer/edge-ai-policy": { cameraReportsLocalEventInsights: () => false },
    "@/lib/domain/event-engine/off-hours": { scheduleIsOffHours: () => false },
    "@/lib/domain/event-engine/event-manifest-policy": { eventManifestPolicy: () => ({ off_hours_active: false, supported_event_types: [], verified_event_types: [] }) },
    "@/lib/domain/digital-observer/camera-health-model": { isExpectedCamera: () => true }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); },
    Date, Map, Set, crypto: { randomUUID: () => "synthetic-audit-id" } },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { get: exports.GET, calls };
}

const request = { headers: { get: () => null } };
const allowed = load();
const response = await allowed.get(request);
assert.equal(response.ok, true);
assert.deepEqual(Array.from(response.data.cameras, (item) => item.camera_id), ["live", "test"]);
assert.equal(response.data.cameras.every((item) => item.monitoring_enabled === true), true);
assert.equal(allowed.calls.sourceReads, 1);
const denied = load(false);
const rejection = await denied.get(request);
assert.equal(rejection.status, 401);
assert.equal(denied.calls.sourceReads, 0);
console.log("event manifest source-mode gate: closed route tests passed");
