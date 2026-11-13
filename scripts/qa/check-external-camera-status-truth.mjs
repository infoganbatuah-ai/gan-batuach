import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: no external API, database, network, or credentials.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
const compile = (url) => ts.transpileModule(readFileSync(url, "utf8"), {
  fileName: url.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const health = {};
vm.runInNewContext(compile(new URL("../../lib/domain/digital-observer/camera-live-status.ts", import.meta.url)),
  { exports: health, require() { throw Error("Unexpected health dependency"); }, Date },
  { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
const code = compile(new URL("../../app/api/digital-observer/external/v1/[...segments]/route.ts", import.meta.url));
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const now = new Date().toISOString();
const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const rows = [
  { id: "demo", observer_site_id: siteId, source_mode: "demo", status: "connected", health_status: "healthy", last_seen_at: now },
  { id: "live", observer_site_id: siteId, source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: now },
  { id: "stale", observer_site_id: siteId, source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: stale },
  { id: "readiness", observer_site_id: siteId, source_mode: "readiness", status: "connected", health_status: "healthy", last_seen_at: now }
];

function load(authorized = true) {
  const calls = { reads: 0, scopes: [], operations: [], receipts: [], usage: [] };
  const admin = { from(table) {
    assert.equal(table, "digital_observer_camera_sources"); calls.reads++;
    let id = null;
    const query = { select() { return query; }, eq(column, value) { if (column === "id") id = value; return query; },
      order() { return query; }, range() { return query; },
      then(resolve) { return Promise.resolve({ data: id ? rows.filter((row) => row.id === id) : rows, error: null }).then(resolve); },
      async maybeSingle() { return { data: rows.find((row) => row.id === id) ?? null, error: null }; }
    };
    return query;
  } };
  const forbidden = () => { throw Error("Unrelated route path"); };
  const imports = {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status, headers: options.headers }) } },
    "node:crypto": localRequire("node:crypto"),
    "@/lib/domain/digital-observer/external-api-contract": { encodeCursor: (offset) => String(offset), externalApiError: (code) => ({ error: code }),
      federationQuerySchema: {}, ganBatuachRoleMapping: {}, integrationCapabilityTruth: forbidden, integrationDeepLinkSchema: {}, investigationRequestSchema: {},
      parseCursor: () => 0, siteQuerySchema: { parse: (input) => ({ ...input, limit: 10 }) }, webhookSubscriptionSchema: {}, watchRuleRequestSchema: {} },
    "@/lib/domain/digital-observer/external-api-openapi": { digitalObserverExternalOpenApi: {} },
    "@/lib/domain/digital-observer/external-api-service": {
      authenticateExternalApiRequest: async () => ({ admin, actor: { id: "synthetic-actor", idempotentReplay: false } }),
      authorizeExternalApiSite: async (_admin, _actor, input) => { calls.scopes.push(input.scope); assert.equal(input.siteId, siteId); if (!authorized) throw Error("EXTERNAL_API_SITE_SCOPE_DENIED"); return { id: siteId }; },
      assertExternalApiRateLimit: async () => {}, completeExternalApiReceipt: async (_admin, _actor, input) => { calls.receipts.push(input); },
      externalApiMeta: () => ({ synthetic: true }), recordExternalApiUsage: async (_admin, _actor, input) => { calls.operations.push(input.operation); calls.usage.push(input); },
      registerExternalWebhook: forbidden },
    "@/lib/domain/digital-observer/investigation-query": { compileInvestigationQuery: forbidden, validateInvestigationQuery: forbidden },
    "@/lib/domain/digital-observer/investigation-search-service": { searchDigitalObserverInvestigation: forbidden },
    "@/lib/domain/digital-observer/watch-rule-service": { compileAuthorizedWatchRule: forbidden, simulateWatchRuleAgainstRealHistory: forbidden },
    "@/lib/domain/digital-observer/storage-contract.mjs": { createSupabaseStorageBackend: forbidden },
    "@/lib/domain/digital-observer/camera-live-status": health
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); }, URL, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { get: exports.GET, calls };
}

async function request(loaded, segments) {
  return loaded.get({ method: "GET", url: `https://synthetic.invalid/api?site_id=${siteId}`, headers: { get: () => null } },
    { params: Promise.resolve({ segments }) });
}
const allowed = load();
const list = await request(allowed, ["cameras"]);
assert.equal(list.status, 200);
assert.equal(list.headers["Cache-Control"], "private, no-store, max-age=0");
const byId = Object.fromEntries(list.body.data.map((camera) => [camera.id, camera]));
assert.equal(byId.demo.status, "demo"); assert.equal(byId.demo.health_status, "unknown");
assert.equal(byId.live.status, "connected"); assert.equal(byId.live.health_status, "healthy");
assert.equal(byId.stale.status, "offline"); assert.equal(byId.stale.health_status, "offline");
assert.equal(byId.readiness.status, "readiness");
assert.equal(list.body.pagination.next_cursor, null);
const detail = await request(allowed, ["cameras", "demo"]);
assert.equal(detail.body.camera.status, "demo"); assert.equal(detail.body.camera.health_status, "unknown");
assert.deepEqual(allowed.calls.scopes, ["cameras.read", "cameras.read"]);
assert.deepEqual(allowed.calls.operations, ["cameras.list", "cameras.read"]);
assert.equal(allowed.calls.receipts.length, 2);
const denied = load(false);
const rejection = await request(denied, ["cameras"]);
assert.equal(rejection.status, 403);
assert.equal(denied.calls.reads, 0);
console.log("external camera status truth: closed route tests passed");
