import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Closed actual-route harness: synthetic rows only, no database, network, or side effects.
const localRequire = createRequire(new URL("../../package.json", import.meta.url));
const ts = localRequire("typescript");
function compile(url) {
  return ts.transpileModule(readFileSync(url, "utf8"), {
    fileName: url.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}
const statusExports = {};
vm.runInNewContext(compile(new URL("../../lib/domain/digital-observer/camera-live-status.ts", import.meta.url)),
  { exports: statusExports, require() { throw Error("Unexpected operational-state dependency"); }, Date },
  { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
const routeCode = compile(new URL("../../app/api/digital-observer/conversation/route.ts", import.meta.url));
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const now = new Date().toISOString();
const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const cameras = [
  { id: "demo", status: "connected", health_status: "healthy", source_mode: "demo", last_seen_at: now },
  { id: "readiness", status: "connected", health_status: "healthy", source_mode: "readiness", last_seen_at: now },
  { id: "live", status: "connected", health_status: "healthy", source_mode: "live", last_seen_at: now },
  { id: "gateway", status: "connected", health_status: "healthy", source_mode: "gateway_test", last_health_check_at: now },
  { id: "stale", status: "connected", health_status: "healthy", source_mode: "live", last_seen_at: stale },
  { id: "offline", status: "offline", health_status: "offline", source_mode: "live", last_seen_at: now }
];

function load(authorized) {
  const reads = [];
  const db = { from(table) {
    reads.push(table);
    let columns = "";
    const query = {
      select(value) { columns = value; return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
      then(resolve) {
        if (table === "digital_observer_camera_sources" && columns.includes("source_mode")) {
          assert.ok(columns.includes("last_seen_at") && columns.includes("last_health_check_at"));
          return Promise.resolve({ data: cameras, error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }
    };
    return query;
  } };
  const forbidden = () => { throw Error("Unrelated route path invoked"); };
  const imports = {
    zod: localRequire("zod"),
    "@/lib/api": { fail: (message, status) => ({ ok: false, message, status }), ok: (data) => ({ ok: true, data }), handleRouteError: (error) => { throw error; } },
    "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: async () => ({ profile: { id: "synthetic" }, supabase: db }), getObserverSiteAccess: async (_db, _profile, id, rights) => {
      assert.equal(id, siteId); assert.equal(rights.manage, true); return authorized ? { id: siteId } : null;
    } },
    "@/lib/domain/digital-observer/runtime": { formatObserverDate: forbidden, observerEventLabel: forbidden },
    "@/lib/domain/event-engine/event-journal-service": { eventJournalService: { groupRows: () => [], normalize: forbidden } },
    "@/lib/domain/digital-observer/guard-chat-handler": { guardChatHandler: { classify: () => "status" } },
    "@/lib/domain/digital-observer/guard-chat-query": { guardJournalQuerySchema: localRequire("zod").any(), guardQueryClarification: forbidden },
    "@/lib/domain/event-engine/guard-journal-search": { guardContextForSite: () => ({}), guardHistoryPrivacyRestricted: () => false, guardHistoryInput: () => null, guardJournalAnswer: forbidden, searchGuardJournal: forbidden },
    "@/lib/domain/digital-observer/watch-rule-service": { compileAuthorizedWatchRule: forbidden },
    "@/lib/domain/digital-observer/investigation-query": { compileInvestigationQuery: forbidden, isInvestigationQuestion: () => false },
    "@/lib/domain/digital-observer/investigation-search-service": { searchDigitalObserverInvestigation: forbidden },
    "@/lib/domain/digital-observer/camera-live-status": statusExports
  };
  const exports = {};
  vm.runInNewContext(routeCode, { exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unmapped import ${name}`); }, Date },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { post: exports.POST, reads };
}

const allowed = load(true);
const response = await allowed.post({ json: async () => ({ observer_site_id: siteId, message: "מה המצב?" }) });
assert.equal(response.ok, true);
assert.match(response.data.answer, /2 מתוך 6/);
assert.ok(allowed.reads.includes("digital_observer_camera_sources"));
const denied = load(false);
const rejection = await denied.post({ json: async () => ({ observer_site_id: siteId, message: "מה המצב?" }) });
assert.equal(rejection.status, 403);
assert.deepEqual(denied.reads, []);
console.log("conversation demo status truth: closed route tests passed");
