import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic event and authenticated Gateway, no DB or network.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const route = new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(route, "utf8"), {
  fileName: route.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const cameraId = "6fddc732-13df-4268-9f32-3357262ea997";
const gatewayId = "synthetic-gateway";
const streamId = "synthetic-stream";

function load(mode, mismatch = false) {
  const calls = { tables: [], writes: 0, validations: 0, outbox: 0 };
  const db = { from(table) {
    calls.tables.push(table);
    const query = {
      select() { return query; }, eq() { return query; },
      async single() {
        if (table === "observer_sites") return { data: { id: siteId, garden_id: null, site_type: "home", monitoring_enabled: true, metadata: { observer_monitoring_consent: true } }, error: null };
        throw Error(`Unexpected single ${table}`);
      },
      async maybeSingle() {
        if (table === "digital_observer_camera_sources") return { data: { id: cameraId, observer_site_id: siteId,
          source_mode: mode, status: "connected", metadata: { gateway_id: gatewayId, gateway_stream_id: mismatch ? "wrong" : streamId } }, error: null };
        throw Error(`Unexpected maybeSingle ${table}`);
      },
      insert() { calls.writes++; throw Error("Persistence forbidden in closed harness"); }
    };
    return query;
  } };
  const forbidden = () => { calls.outbox++; throw Error("Side effect forbidden in closed harness"); };
  const imports = {
    "node:crypto": localRequire("node:crypto"),
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data, status = 200) => ({ ok: true, data, status }), handleRouteError: (error) => { throw error; } },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/domain/event-engine/gateway-auth": { authenticateEventGateway: async () => ({ observer_site_id: siteId, gateway_id: gatewayId }) },
    "@/lib/domain/event-engine/event-validation-pipeline": { eventValidationPipeline: { validate: () => { calls.validations++; return { accepted: false, reason: "synthetic-rejection" }; } } },
    "@/lib/domain/event-engine/camera-zone-mapper": { validCrossingLine: forbidden },
    "@/lib/domain/event-engine/event-evidence-compatibility": { cloudCameraEventSchema: { parse: (value) => value }, eventEvidenceCompatibility: forbidden },
    "@/lib/domain/event-engine/cloud-event-observation": { buildCanonicalCloudObservation: forbidden, matchesCanonicalCloudObservation: forbidden },
    "@/lib/domain/event-engine/off-hours": { scheduleIsOffHours: forbidden },
    "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative: forbidden },
    "@/lib/domain/digital-observer/guard-autonomy-service": { dispatchDigitalGuardActionsForValidatedEvent: forbidden },
    "@/lib/domain/event-engine/notifications": { recordEventNotifications: forbidden },
    "@/lib/domain/event-engine/media-fault-lifecycle": { openMediaFault: forbidden },
    "@/lib/security/audit-log-service": { writeAuditEvent: forbidden },
    "@/lib/domain/digital-observer/home-learning-sampler": { refreshRealEventContextBaseline: forbidden },
    "@/lib/domain/digital-observer/risk-decision-service": { evaluateAndPersistIncidentRisk: forbidden },
    "@/lib/domain/digital-observer/commercial-billing-service": { assertCommercialEntitlement: async () => ({ allowed: true }) }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); }, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, calls };
}

async function send(loaded) {
  return loaded.post({ json: async () => ({ camera_source_id: cameraId, stream_id: streamId, timestamp: new Date().toISOString() }) });
}
for (const mode of ["demo", "readiness", "mock", "local_shadow", null]) {
  const loaded = load(mode);
  const response = await send(loaded);
  assert.equal(response.status, 403);
  assert.equal(loaded.calls.validations, 0);
  assert.equal(loaded.calls.writes, 0);
  assert.equal(loaded.calls.outbox, 0);
  assert.ok(!loaded.calls.tables.includes("observer_intelligence_signals"));
}
for (const mode of ["live", "gateway_test"]) {
  const loaded = load(mode);
  const response = await send(loaded);
  assert.equal(response.ok, true);
  assert.equal(response.data.status, "suppressed");
  assert.equal(loaded.calls.validations, 1);
}
const mismatch = load("live", true);
const rejection = await send(mismatch);
assert.equal(rejection.status, 403);
assert.equal(mismatch.calls.validations, 0);
console.log("cloud events source-mode gate: closed route tests passed");
