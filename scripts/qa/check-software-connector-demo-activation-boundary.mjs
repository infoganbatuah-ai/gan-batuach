import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Closed route harness: no database, network, credentials, or live service calls.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const zod = localRequire("zod");
const routePath = new URL("../../app/api/digital-observer/software-connector/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(routePath, "utf8"), {
  fileName: routePath.pathname,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const cameraId = "6fddc732-13df-4268-9f32-3357262ea997";
const gatewayId = "a3b8d4cb-46ac-4f64-a999-61a65a39c704";

function load(sourceMode) {
  const calls = { tables: [], writes: 0, outcomes: 0, access: 0 };
  const now = new Date().toISOString();
  const source = {
    id: cameraId, observer_site_id: siteId, source_mode: sourceMode,
    status: "connected", health_status: "healthy", last_seen_at: now,
    secret_reference: "synthetic-reference", capabilities: {},
    metadata: { connector_device_type: "SOFTWARE_CONNECTOR", gateway_id: gatewayId, active_monitoring: false }
  };
  const admin = {
    from(table) {
      calls.tables.push(table);
      const query = {
        select(columns) { if (table === "digital_observer_camera_sources" && !calls.writes) assert.ok(columns.split(",").includes("source_mode")); return query; }, eq() { return query; },
        update() { calls.writes++; return query; },
        async maybeSingle() {
          if (table === "digital_observer_camera_sources") return { data: calls.writes ? { id: cameraId } : source, error: null };
          if (table === "video_gateway_device_enrollments") return { data: { id: gatewayId, metadata: { device_type: "SOFTWARE_CONNECTOR", last_heartbeat_at: now, health: { status: "HEALTHY" } } }, error: null };
          throw Error(`Unexpected table: ${table}`);
        }
      };
      return query;
    }
  };
  const forbidden = () => { throw Error("Forbidden unrelated path"); };
  const imports = {
    "node:crypto": localRequire("node:crypto"), "node:net": localRequire("node:net"),
    "next/server": { NextResponse: forbidden }, zod,
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleSafeRouteError: forbidden },
    "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: async () => ({ profile: { id: "synthetic-user" }, supabase: {} }), getObserverSiteAccess: async (_db, _profile, id, rights) => { calls.access++; assert.equal(id, siteId); assert.equal(rights.manage, true); return { id: siteId }; } },
    "@/lib/domain/gateway-device-enrollment": { gatewayDeviceSessionAllows: forbidden, verifyGatewayDeviceAccessToken: forbidden },
    "@/lib/security/encryption": { decryptField: forbidden, encryptField: forbidden },
    "@/lib/security/rate-limit": { assertRateLimit: async () => {} },
    "@/lib/security/request-guards": { assertTrustedMutationOrigin: () => {}, parseBoundedJson: async (request) => request.payload, privateRateLimitIdentifier: () => "synthetic" },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/domain/digital-observer/connection-outcome-service": { recordConnectivityOutcome: async () => { calls.outcomes++; } },
    "@/lib/domain/digital-observer/connectivity-registry": { connectivityRegistryVersion: "synthetic" },
    "@/lib/domain/digital-observer/connection-orchestrator": { connectionOrchestratorVersion: "synthetic" },
    "@/lib/domain/digital-observer/connection-assessment-service": { assessAuthorizedCameraSystem: forbidden }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import: ${name}`); }, process: { env: {} }, Date, setTimeout: forbidden, fetch: forbidden }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, calls };
}

async function activate(mode) {
  const { post, calls } = load(mode);
  const response = await post({ headers: { get: () => null }, payload: { action: "activate", observer_site_id: siteId, camera_source_id: cameraId } });
  return { response, calls };
}

const demo = await activate("demo");
assert.equal(demo.response.status, 404);
assert.equal(demo.calls.access, 1);
assert.deepEqual(demo.calls.tables, ["digital_observer_camera_sources"]);
assert.equal(demo.calls.writes, 0);
assert.equal(demo.calls.outcomes, 0);

const live = await activate("live");
assert.equal(live.response.ok, true);
assert.equal(live.response.data.status, "ACTIVE_MONITORING");
assert.equal(live.calls.access, 1);
assert.equal(live.calls.writes, 1);
assert.equal(live.calls.outcomes, 1);
assert.deepEqual(live.calls.tables, ["digital_observer_camera_sources", "video_gateway_device_enrollments", "digital_observer_camera_sources"]);

console.log("software connector demo activation boundary: closed route tests passed");
