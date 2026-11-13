import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic partner session and rows, no network or database.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
function compile(url) { return ts.transpileModule(readFileSync(url, "utf8"), {
  fileName: url.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText; }
const health = {};
vm.runInNewContext(compile(new URL("../../lib/domain/digital-observer/camera-live-status.ts", import.meta.url)),
  { exports: health, require() { throw Error("Unexpected health dependency"); }, Date },
  { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
const code = compile(new URL("../../app/api/digital-observer/embed/v1/dashboard/route.ts", import.meta.url));
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const now = new Date().toISOString();
const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const rows = [
  { id: "demo", source_mode: "demo", status: "connected", health_status: "healthy", last_seen_at: null, last_health_check_at: null },
  { id: "live", source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: now, last_health_check_at: now },
  { id: "stale", source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: stale, last_health_check_at: stale },
  { id: "readiness", source_mode: "readiness", status: "connected", health_status: "healthy", last_seen_at: now, last_health_check_at: now }
];

function load(authorized = true) {
  const calls = { tables: [], scope: null, site: null };
  const admin = { from(table) {
    calls.tables.push(table);
    let selected = "";
    const query = {
      select(value) { selected = value; return query; }, eq() { return query; }, is() { return query; }, neq() { return query; },
      order() { return query; }, limit() { return query; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      single() { return Promise.resolve({ data: { id: siteId }, error: null }); },
      then(resolve) {
        if (table === "digital_observer_camera_sources") assert.ok(selected.split(",").includes("source_mode"));
        return Promise.resolve({ data: table === "digital_observer_camera_sources" ? rows : [], error: null }).then(resolve);
      }
    };
    return query;
  } };
  const imports = {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } },
    "@/lib/domain/digital-observer/partner-platform-service": { authenticateEmbeddedSession: async (_admin, input) => {
      calls.scope = input.requiredScope; if (!authorized) throw Error("AUTH_DENIED");
      return { partner_id: "synthetic-partner", observer_site_id: siteId, scopes: ["cameras.read"], expires_at: now };
    } },
    "@/lib/domain/digital-observer/partner-platform": { publicBrandProfile: () => null },
    "@/lib/supabase/admin": { createAdminClient: () => admin, isAdminClientConfigured: () => true },
    "@/lib/domain/digital-observer/camera-live-status": health
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); }, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { get: exports.GET, calls };
}

const request = { headers: { get(name) { if (name === "authorization") return "Bearer doemb_synthetic"; if (name === "x-do-audience") return "synthetic"; return null; } } };
const allowed = load();
const result = await allowed.get(request);
assert.equal(result.status, 200);
assert.equal(allowed.calls.scope, "cameras.read");
assert.equal(result.headers["cache-control"], "no-store");
assert.equal(result.body.production_proof, false);
assert.equal(result.body.raw_video_embedded, false);
const byId = Object.fromEntries(result.body.cameras.map((camera) => [camera.id, camera]));
assert.equal(byId.demo.status, "demo"); assert.equal(byId.demo.health_status, "unknown");
assert.equal(byId.live.status, "connected"); assert.equal(byId.live.health_status, "healthy");
assert.equal(byId.stale.status, "offline"); assert.equal(byId.stale.health_status, "offline");
assert.equal(byId.readiness.status, "readiness"); assert.equal(byId.readiness.health_status, "unknown");
assert.equal(result.body.camera_health.find((item) => item.camera_id === "demo").status, "unknown");
const denied = load(false);
const rejection = await denied.get(request);
assert.equal(rejection.status, 401);
assert.deepEqual(denied.calls.tables, []);
console.log("embedded camera health truth: closed route tests passed");
