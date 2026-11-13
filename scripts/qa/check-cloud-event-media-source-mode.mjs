import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness. Only synthetic bytes; storage, DB and network are forbidden.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const route = new URL("../../app/api/video-gateway/cloud-event-media/route.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(route, "utf8"), {
  fileName: route.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const cameraId = "6fddc732-13df-4268-9f32-3357262ea997";
const eventId = "a3b8d4cb-46ac-4f64-a999-61a65a39c704";
const gatewayId = "synthetic-gateway";
const streamId = "synthetic-stream";
class SyntheticFile {
  constructor(type) { this.type = type; this.size = 1; }
  async arrayBuffer() { return Uint8Array.of(1).buffer; }
}

function load(mode, mismatch = false) {
  const calls = { tables: [], writes: 0, validations: 0, storage: 0, entitlements: 0 };
  const db = { from(table) {
    calls.tables.push(table);
    const query = { select() { return query; }, eq() { return query; },
      async maybeSingle() {
        if (table === "provider_webhook_events") return { data: null, error: null };
        if (table === "digital_observer_camera_sources") return { data: { id: cameraId, observer_site_id: siteId,
          source_mode: mode, status: "connected", metadata: { gateway_id: gatewayId, gateway_stream_id: mismatch ? "wrong" : streamId } }, error: null };
        throw Error(`Unexpected read ${table}`);
      },
      async insert() { calls.writes++; throw Error("Persistence forbidden in closed harness"); }
    };
    return query;
  } };
  const forbidden = () => { calls.storage++; throw Error("Storage forbidden in closed harness"); };
  const imports = {
    "node:crypto": localRequire("node:crypto"), zod: localRequire("zod"),
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data, status = 200) => ({ ok: true, data, status }) },
    "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative: forbidden },
    "@/lib/domain/event-engine/event-validation-pipeline": { eventValidationPipeline: { validate: () => { calls.validations++; return { accepted: false, reason: "synthetic-rejection" }; } } },
    "@/lib/domain/event-engine/gateway-auth": { authenticateEventGateway: async () => ({ gateway_id: gatewayId, observer_site_id: siteId }) },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/domain/event-engine/media-fault-lifecycle": { resolveMediaFault: forbidden },
    "@/lib/security/audit-log-service": { writeAuditEvent: forbidden },
    "@/lib/domain/digital-observer/storage-contract.mjs": { createStorageObjectId: forbidden, createSupabaseStorageBackend: forbidden },
    "@/lib/domain/digital-observer/commercial-billing-service": { assertCommercialEntitlement: () => { calls.entitlements++; throw Error("Entitlement access forbidden"); } }
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); },
    process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: "synthetic-only" } }, Date, Buffer, File: SyntheticFile },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, calls };
}

async function send(loaded) {
  const metadata = {
    gateway_id: gatewayId, observer_site_id: siteId, event_id: eventId, camera_source_id: cameraId,
    stream_id: streamId, event_type: "camera_media_readiness", evidence_kind: "stream_health",
    captured_at: new Date().toISOString(), duration_seconds: 1,
    local_capture: true, read_only: true, controls_supported: false,
    no_dvr_credentials_returned: true, no_rtsp_returned: true
  };
  const values = new Map([["metadata", JSON.stringify(metadata)], ["clip", new SyntheticFile("video/mp4")], ["thumbnail", new SyntheticFile("image/jpeg")]]);
  return loaded.post({ headers: { get(name) {
    if (name === "x-video-gateway-id") return gatewayId;
    if (name === "x-video-gateway-timestamp") return new Date().toISOString();
    if (name === "x-video-gateway-nonce") return "synthetic-nonce";
    if (name === "x-video-gateway-device-token") return "synthetic-device";
    return null;
  } }, formData: async () => ({ get: (name) => values.get(name) }) });
}

for (const mode of ["demo", "readiness", "mock", "local_shadow", null]) {
  const loaded = load(mode);
  const response = await send(loaded);
  assert.equal(response.status, 403);
  assert.equal(loaded.calls.validations, 0);
  assert.equal(loaded.calls.writes, 0);
  assert.equal(loaded.calls.storage, 0);
  assert.equal(loaded.calls.entitlements, 0);
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
console.log("cloud event media source-mode gate: closed route tests passed");
