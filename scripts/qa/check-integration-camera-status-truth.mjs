import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic token/rows only; no database or network.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const compile = (url) => ts.transpileModule(readFileSync(url, "utf8"), {
  fileName: url.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const health = {};
vm.runInNewContext(compile(new URL("../../lib/domain/digital-observer/camera-live-status.ts", import.meta.url)),
  { exports: health, require() { throw Error("Unexpected health dependency"); }, Date },
  { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
const code = compile(new URL("../../app/api/digital-observer/integration/v1/sites/[id]/status/route.ts", import.meta.url));
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const token = "synthetic-integration-token";
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date().toISOString();
const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const sourceRows = [
  { id: "demo", camera_stream_id: "stream-demo", source_mode: "demo", status: "connected", health_status: "healthy", last_seen_at: now },
  { id: "live", camera_stream_id: "stream-live", source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: now },
  { id: "stale", camera_stream_id: "stream-stale", source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: stale },
  { id: "readiness", camera_stream_id: "stream-readiness", source_mode: "readiness", status: "connected", health_status: "healthy", last_seen_at: now }
];
const legacy = { id: "legacy", status: "legacy-status", health_status: "legacy-health", last_seen: now };

function load(scopes) {
  const calls = { tables: [], audit: [] };
  const db = { from(table) {
    calls.tables.push(table);
    const query = {
      select() { return query; }, eq() { return query; }, not() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; },
      insert(value) { calls.audit.push(value); return Promise.resolve({ error: null }); },
      async maybeSingle() {
        if (table === "digital_observer_integration_clients") return { data: { id: "synthetic-client", allowed_scopes: scopes }, error: null };
        if (table === "observer_sites") return { data: { id: siteId, garden_id: "synthetic-garden", name: "QA", active: true, monitoring_enabled: true }, error: null };
        throw Error(`Unexpected maybeSingle ${table}`);
      },
      then(resolve) {
        const data = table === "digital_observer_camera_sources" ? sourceRows : table === "camera_streams" ? [legacy] : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      }
    };
    return query;
  } };
  const imports = {
    "node:crypto": localRequire("node:crypto"),
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status, headers: options.headers }) } },
    "@/lib/supabase/admin": { createAdminClient: () => db, isAdminClientConfigured: () => true },
    "@/lib/domain/digital-observer/camera-live-status": health
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); },
    process: { env: { DIGITAL_OBSERVER_GAN_BATUACH_INTEGRATION_ENABLED: "true", DIGITAL_OBSERVER_INTEGRATION_TOKEN_HASH: tokenHash } }, Buffer, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { get: exports.GET, calls };
}

const request = { headers: { get(name) { return name === "authorization" ? `Bearer ${token}` : null; } } };
const context = { params: Promise.resolve({ id: siteId }) };
const allowed = load(["camera.health:read", "events.reviewed:read"]);
const response = await allowed.get(request, context);
assert.equal(response.status, 200);
assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
const byId = Object.fromEntries(response.body.cameras.map((camera) => [camera.id, camera]));
assert.equal(byId.demo.status, "demo"); assert.equal(byId.demo.health_status, "unknown");
assert.equal(byId.live.status, "connected"); assert.equal(byId.live.health_status, "healthy");
assert.equal(byId.stale.status, "offline"); assert.equal(byId.stale.health_status, "offline");
assert.equal(byId.readiness.status, "readiness"); assert.equal(byId.readiness.health_status, "unknown");
assert.equal(byId.legacy.status, "legacy-status"); assert.equal(byId.legacy.health_status, "legacy-health");
assert.equal(allowed.calls.audit.at(-1).result_status, "allowed");

const denied = load(["camera.health:read"]);
const rejection = await denied.get(request, context);
assert.equal(rejection.status, 403);
assert.equal(denied.calls.audit.at(-1).result_status, "denied");
assert.ok(!denied.calls.tables.includes("digital_observer_camera_sources"));
console.log("integration camera status truth: closed route tests passed");
