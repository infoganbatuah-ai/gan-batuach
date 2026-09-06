import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const { correlateCanonicalEvents, legalIncidentTransition } = await import("../../lib/domain/digital-observer/incident-correlation.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20260905010000_digital_observer_canonical_incidents.sql", import.meta.url), "utf8");
const base = Date.parse("2026-09-05T18:29:32.778Z");
const event = (id, type, offset, overrides = {}) => ({
  id, observer_site_id: "site-a", created_at: new Date(base + offset).toISOString(),
  confidence: .88, severity: "critical",
  metadata: { event_type: type, camera_source_id: "camera-a", camera_name: "Entrance", stream_id: "stream-a", track_id: "track-a", zone_type: "ENTRANCE", observation_provenance: "REAL_CAMERA_AI", evidence_kind: "line_crossing", ...overrides }
});

const entered = event("00000000-0000-4000-a000-000000000001", "person_entered", 0);
const exited = event("00000000-0000-4000-a000-000000000002", "person_exited", 42_219);
const one = correlateCanonicalEvents([exited, entered, exited]);
assert.equal(one.length, 1, "same real site/camera/track entry and exit become one Incident");
assert.equal(one[0].status, "closed");
assert.deepEqual(one[0].related_event_ids, [entered.id, exited.id], "duplicate delivery is idempotent");
assert.deepEqual(one[0].timeline_summary.map(item => item.event_type), ["person_entered", "person_exited"], "timeline remains chronological");
assert(one[0].timeline_summary.every(item => item.provenance === "REAL_CAMERA_AI"));
assert(one[0].timeline_summary.every(item => item.evidence_kind === "line_crossing"), "event evidence references remain attached to source Events");

assert.equal(correlateCanonicalEvents([entered, event("00000000-0000-4000-a000-000000000003", "person_exited", 10_000, { track_id: "track-b" })])[0].status, "open", "different tracks do not merge");
assert.equal(correlateCanonicalEvents([entered, event("00000000-0000-4000-a000-000000000004", "person_exited", 10_000, { camera_source_id: "camera-b" })])[0].status, "open", "different cameras do not merge");
assert.equal(correlateCanonicalEvents([entered, { ...exited, id: "00000000-0000-4000-a000-000000000005", observer_site_id: "site-b" }])[0].status, "open", "different sites do not merge");
assert.equal(correlateCanonicalEvents([entered, { ...exited, id: "00000000-0000-4000-a000-000000000006", metadata: { ...exited.metadata, observation_provenance: "SHADOW_AI" } }])[0].status, "open", "shadow output cannot contaminate a real Incident");
const later = event("00000000-0000-4000-a000-000000000007", "person_entered", 11 * 60_000);
assert.equal(correlateCanonicalEvents([entered, exited, later]).length, 2, "a later situation after closure creates a new Incident");
assert.equal(correlateCanonicalEvents([exited]).length, 0, "exit without correlated entry cannot invent an Incident");
assert.equal(legalIncidentTransition("open", "acknowledged"), true);
assert.equal(legalIncidentTransition("acknowledged", "closed"), true);
assert.equal(legalIncidentTransition("closed", "open"), false);

for (const required of [
  "observer_incident_signal_one_timeline_idx", "pg_advisory_xact_lock", "same site + camera + track ID",
  "observer_intelligence_signal", "INVALID_INCIDENT_STATE_TRANSITION", "observation_provenance' <> 'REAL_CAMERA_AI'"
]) assert(migration.includes(required), `migration missing ${required}`);

console.log("Digital Observer Incident checks passed: real entry/exit correlation, timeline order, idempotency, state machine, evidence reference, mock and tenant/camera/track boundaries.");
