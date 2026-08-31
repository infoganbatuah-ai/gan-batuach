import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as catalog from "../../lib/domain/digital-observer/conversation-actions.ts";
import { observerEventNarrative } from "../../lib/domain/digital-observer/event-narrative.ts";

assert.equal(catalog.parseObserverConversationIntent("האם הסירנה עובדת?").intent, "search_events");
assert.equal(catalog.parseObserverConversationIntent("האם תעקוב אחרי הדלת?").intent, "search_events");
assert.equal(catalog.parseObserverConversationIntent("אל תפעיל אור").physical, null);
assert.equal(catalog.parseObserverConversationIntent("הפעל אור ואז סירנה").intent, "clarify_action");
assert.equal(catalog.parseObserverConversationIntent("הפעל סירנה אם מישהו נכנס").physical, null);
assert.equal(catalog.parseObserverConversationIntent("הזז מצלמה").physical, null);
assert.equal(catalog.parseObserverConversationIntent("הזז מצלמה ימינה").physical.parameters.direction, "right");
assert.equal(catalog.parseObserverConversationIntent("כבה סירנה").physical.action_type, "siren_off");
assert.equal(catalog.parseObserverConversationIntent("איך מוסיפים מקליט?").intent, "guide_navigation");
assert.deepEqual(catalog.observerConversationLinks("https://untrusted.invalid", undefined, []), []);
const now = Date.now();
const evidence = { supported: true, adapter: "synthetic", method: "read_only", tested_at: new Date(now - 1000).toISOString() };
const siteId = randomUUID(), sourceId = randomUUID(), profileId = randomUUID();
let consent = false, authorized = true, loggedIn = true, cameraStatus = "connected", actionConsent = true;
let auditFailure = null, saveFailure = false, auditThrows = false;
const writes = [], queries = [];
const camera = () => ({ id: sourceId, display_name: "Synthetic source", status: cameraStatus, capabilities: { capability_evidence: { siren: evidence } }, metadata: {} });
assert.ok(catalog.verifiedConversationActionEvidence(camera(), "siren", now));
assert.equal(catalog.verifiedConversationActionEvidence(camera(), "siren", now - 2000), null);
assert.equal(catalog.verifiedConversationActionEvidence(camera(), "siren", now + 86400000), null);
assert.equal(catalog.verifiedConversationActionEvidence({ ...camera(), status: "offline" }, "siren", now), null);
const migration = readFileSync("supabase/migrations/20260831010000_observer_conversation_action_audit.sql", "utf8");
assert.match(migration, /'observer_conversation_action'/);
assert.match(migration, /validate constraint observer_capability_audit_type_check/);
assert.match(migration, /as restrictive[\s\S]*for insert to authenticated[\s\S]*event_type <> 'observer_conversation_action'/);
for (const type of ["consent_revoked", "biometric_reference_deleted", "camera_action_result"]) assert.ok(migration.includes(`'${type}'`));

const db = { from(table) {
  const q = { table, filters: [], write: null }; queries.push(q);
  const resolve = () => {
    if (q.write && q.table === "observer_capability_audit_events" && auditFailure === q.write.reason && auditThrows) throw new Error("synthetic audit transport failure");
    if (q.write) return { error: table === "observer_capability_audit_events" && auditFailure === q.write.reason || table === "observer_watch_requests" && saveFailure ? { code: "synthetic_failure" } : null, data: { id: randomUUID(), ...q.write } };
    return { error: null, data: table === "digital_observer_camera_sources" ? [camera()] : [] };
  };
  const chain = {
    select: () => chain, order: () => chain, limit: () => chain,
    eq: (key, value) => { q.filters.push([key, value]); return chain; },
    gte: (key, value) => { q.filters.push([key, value]); return chain; },
    or: (value) => { q.filters.push(["or", value]); return chain; },
    insert: (value) => { q.write = value; writes.push(q); return chain; },
    single: async () => resolve(), then: (done) => Promise.resolve(resolve()).then(done)
  };
  return chain;
} };
const modules = {
  zod: { z }, "node:crypto": { randomUUID },
  "@/lib/domain/digital-observer/conversation-actions": catalog,
  "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative },
  "@/lib/domain/digital-observer/runtime": { formatObserverDate: (date) => date },
  "@/lib/supabase/admin": { createAdminClient: () => { assert.equal(authorized, true); assert.equal(loggedIn, true); return db; } },
  "@/lib/api": { ok: (data) => Response.json({ data }), fail: (error, status) => Response.json({ error }, { status }), handleRouteError: () => Response.json({ error: "invalid" }, { status: 400 }) },
  "@/lib/domain/digital-observer/access": {
    getDigitalObserverApiUser: async () => loggedIn ? { profile: { id: profileId }, supabase: db } : null,
    getObserverSiteAccess: async (_db, _profile, id, options) => {
      assert.equal(id, siteId); assert.equal(options.manage, true);
      return authorized ? { monitoring_enabled: consent, metadata: { observer_monitoring_consent: consent, observer_safe_action_consent: actionConsent } } : null;
    }
  }
};
const exports = {};
runInNewContext(ts.transpileModule(readFileSync("app/api/digital-observer/conversation/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { exports, Request, Response, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
async function ask(message, source = sourceId) {
  writes.length = 0; queries.length = 0;
  const response = await exports.POST(new Request("https://synthetic.invalid/conversation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ observer_site_id: siteId, camera_source_id: source, message }) }));
  return { status: response.status, ...(await response.json()) };
}
let result = await ask("מה המצב?");
assert.equal(result.status, 200); assert.equal(result.data.action_result.state, "executed");
assert.equal(result.data.live_ai_used, false); assert.equal(result.data.coverage.dvr_archive_scanned, false);
assert.equal(writes.length, 2); assert.ok(writes.every((q) => q.table === "observer_capability_audit_events"));
assert.ok(result.data.links.every((link) => link.href.startsWith("/digital-observer/") && link.href.includes(`site=${siteId}`)));
assert.ok(result.data.links.find((link) => link.href.includes("/cameras?")).href.includes(`camera=${sourceId}`));
assert.ok(queries[0].filters.some(([key]) => key === "or"));
assert.ok(queries[0].filters.some(([key]) => key === "created_at"));
result = await ask("שים לב לדלת");
assert.equal(result.data.action_result.state, "saved");
let watch = writes.find((q) => q.table === "observer_watch_requests").write;
assert.equal(watch.active, false); assert.equal(watch.metadata.execution_state, "awaiting_monitoring_consent");
consent = true;
result = await ask("שים לב לדלת");
watch = writes.find((q) => q.table === "observer_watch_requests").write;
assert.equal(watch.active, false); assert.equal(watch.metadata.rule_execution_verified, false);
assert.equal(watch.metadata.execution_state, "awaiting_rule_evidence");
assert.equal(result.data.answer.includes("פעילה במצב Shadow"), false);
result = await ask("האם הסירנה עובדת?"); assert.equal(result.data.suggested_camera_action, null);
result = await ask("הפעל סירנה"); assert.equal(result.data.action_result.state, "awaiting_confirmation");
assert.equal(result.data.action_result.physical_action_executed, false);
assert.ok(writes.every((q) => q.table === "observer_capability_audit_events"));
actionConsent = false;
result = await ask("הפעל סירנה"); assert.equal(result.data.action_result.state, "blocked");
actionConsent = true; cameraStatus = "offline";
result = await ask("הפעל סירנה"); assert.equal(result.data.action_result.state, "blocked");
cameraStatus = "connected";
result = await ask("מה המצב?", randomUUID()); assert.equal(result.status, 403); assert.equal(writes.length, 0);
authorized = false; result = await ask("שים לב לדלת"); assert.equal(result.status, 403); assert.equal(writes.length, 0);
authorized = true; loggedIn = false; result = await ask("מה המצב?"); assert.equal(result.status, 401); assert.equal(writes.length, 0);
loggedIn = true; auditFailure = "requested";
result = await ask("שים לב לדלת"); assert.equal(result.status, 503); assert.equal(writes.some((q) => q.table === "observer_watch_requests"), false);
auditFailure = null; saveFailure = true;
result = await ask("שים לב לדלת"); assert.equal(result.status, 400); assert.equal(writes.at(-1).write.reason, "failed");
saveFailure = false; auditFailure = "saved";
result = await ask("שים לב לדלת"); assert.equal(result.data.action_result.state, "saved"); assert.equal(result.data.action_result.result_audited, false);
assert.match(result.data.answer, /אין לשלוח אותה שוב/);
auditThrows = true;
result = await ask("שים לב לדלת"); assert.equal(result.status, 200); assert.equal(result.data.action_result.state, "saved");
assert.equal(result.data.action_result.result_audited, false);
console.log("PASS: chat action catalog, tenant/consent/evidence gates, audit failures, truthful saved/read states and no physical execution");
