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
    if (url.endsWith(".ts")) return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText
    };
    return next(url, context);
  }
});

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const {
  DIGITAL_OBSERVER_CANONICAL_DOMAINS,
  DIGITAL_OBSERVER_COMPATIBILITY_PATHS,
  DIGITAL_OBSERVER_EVENT_PROVENANCE,
  DIGITAL_OBSERVER_INCIDENT_VERSION,
  LEGACY_KINDERGARTEN_CORRELATION_VERSION,
  isCanonicalDigitalObserverIncident
} = await import("../../lib/domain/digital-observer/canonical-domain.ts");

assert.deepEqual(Object.keys(DIGITAL_OBSERVER_CANONICAL_DOMAINS), [
  "cameraSource", "event", "incident", "evidence", "risk", "verification",
  "decision", "watchRules", "investigation", "feedback", "health"
]);
assert.ok(Object.values(DIGITAL_OBSERVER_CANONICAL_DOMAINS).every((item) => typeof item.owner === "string" && item.owner.length > 0),
  "each canonical concept must have one explicit runtime owner");
assert.equal(DIGITAL_OBSERVER_CANONICAL_DOMAINS.event.store, "observer_intelligence_signals");
assert.equal(DIGITAL_OBSERVER_CANONICAL_DOMAINS.incident.discriminator, DIGITAL_OBSERVER_INCIDENT_VERSION);
assert.equal(DIGITAL_OBSERVER_CANONICAL_DOMAINS.evidence.store, "digital_observer_event_clips");
assert.equal(DIGITAL_OBSERVER_COMPATIBILITY_PATHS.kindergartenAiEvents.scope, "kindergarten product only");
assert.equal(DIGITAL_OBSERVER_COMPATIBILITY_PATHS.legacyWatchRequestPolicy.class, "COMPATIBILITY");

assert.equal(isCanonicalDigitalObserverIncident({
  correlation_version: DIGITAL_OBSERVER_INCIDENT_VERSION,
  provenance: DIGITAL_OBSERVER_EVENT_PROVENANCE
}), true);
for (const row of [
  { correlation_version: LEGACY_KINDERGARTEN_CORRELATION_VERSION, provenance: "SIMULATION" },
  { correlation_version: DIGITAL_OBSERVER_INCIDENT_VERSION, provenance: "SIMULATION" },
  { correlation_version: null, provenance: DIGITAL_OBSERVER_EVENT_PROVENANCE }
]) assert.equal(isCanonicalDigitalObserverIncident(row), false, "legacy/mock incidents must not pass the Product boundary");

const cloudEvents = read("app/api/video-gateway/cloud-events/route.ts");
for (const contract of [
  "authenticateEventGateway", "digital_observer_camera_sources", "observer_intelligence_signals",
  "observation_provenance: \"REAL_CAMERA_AI\"", "source_id", "evaluateAndPersistIncidentRisk",
  "dispatchDigitalGuardActionsForValidatedEvent"
]) assert.ok(cloudEvents.includes(contract), `canonical Event ingest missing ${contract}`);
assert.ok(cloudEvents.indexOf("evaluateAndPersistIncidentRisk") < cloudEvents.indexOf("dispatchDigitalGuardActionsForValidatedEvent({"),
  "Risk/Verification must precede the canonical action path");

const incidentMigration = read("supabase/migrations/20260905010000_digital_observer_canonical_incidents.sql");
for (const contract of [
  "correlate_digital_observer_signal", "observer_incident_signal_one_timeline_idx",
  "correlation_version = 'do-track-v1'", "observation_provenance' <> 'REAL_CAMERA_AI'"
]) assert.ok(incidentMigration.includes(contract), `canonical Incident migration missing ${contract}`);

const productIncidents = read("app/api/digital-observer/incidents/route.ts");
assert.ok(productIncidents.includes("DIGITAL_OBSERVER_INCIDENT_VERSION"));
assert.ok(productIncidents.includes('.eq("correlation_version", DIGITAL_OBSERVER_INCIDENT_VERSION)'));
const legacyCorrelation = read("app/api/observer-correlated-events/route.ts");
for (const marker of [
  'provenance: "SIMULATION"', "LEGACY_KINDERGARTEN_CORRELATION_VERSION",
  'created_by_origin: "legacy_kindergarten_mock"'
]) assert.ok(legacyCorrelation.includes(marker), `legacy correlation is not explicitly isolated: ${marker}`);

const risk = read("lib/domain/digital-observer/risk-decision-service.ts");
const verification = read("lib/domain/digital-observer/incident-verification-service.ts");
assert.ok(risk.includes("evaluateAndPersistIncidentVerification"), "canonical Risk must call Verification");
assert.ok(verification.includes("digital_observer_decision_intents"), "canonical Verification must persist Decision intent");

const investigation = read("lib/domain/digital-observer/investigation-search-service.ts");
assert.ok(investigation.includes("observer_intelligence_signals"));
assert.ok(investigation.includes("observer_correlated_events"));
assert.ok(investigation.includes("digital_observer_event_clips"));
assert.ok(investigation.includes("DIGITAL_OBSERVER_INCIDENT_VERSION"));
assert.ok(!investigation.includes("incident_reports"), "Product Investigation must not fall back to kindergarten Incidents");

for (const path of [
  "app/api/digital-observer/event-journal/route.ts",
  "app/api/digital-observer/incidents/route.ts",
  "lib/domain/digital-observer/investigation-search-service.ts"
]) {
  const source = read(path);
  assert.ok(!source.includes('from("ai_events"'), `${path} reads legacy ai_events`);
  assert.ok(!source.includes('from("ai_camera_events"'), `${path} reads mock ai_camera_events`);
  assert.ok(!source.includes('from("incident_reports"'), `${path} reads kindergarten incident_reports`);
}

const migrations = [
  "supabase/migrations/20260905010000_digital_observer_canonical_incidents.sql",
  "supabase/migrations/20260906010000_digital_observer_risk_decision_engine.sql",
  "supabase/migrations/20260906020000_digital_observer_incident_verification.sql"
].map(read).join("\n");
assert.ok(migrations.includes("digital_observer_risk_evaluations"));
assert.ok(migrations.includes("digital_observer_incident_verifications"));
assert.ok(migrations.includes("digital_observer_decision_intents"));

const northStar = read("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md");
const allowedStates = [
  "DONE + REAL PROOF", "IMPLEMENTED — NEEDS REAL PROOF", "FOUNDATION",
  "PARTIAL", "NOT STARTED", "EXTERNAL COVERAGE GAP"
];
const capabilityRows = northStar.split("\n").filter((line) => {
  if (!line.startsWith("| ")) return false;
  return allowedStates.includes(line.split("|")[2]?.trim());
});
assert.equal(capabilityRows.length, 190, "North-Star ledger must remain exactly 190 capabilities");
const counts = Object.fromEntries(allowedStates.map((state) => [state, capabilityRows.filter((line) => line.split("|")[2]?.trim() === state).length]));
assert.deepEqual(counts, {
  "DONE + REAL PROOF": 24,
  "IMPLEMENTED — NEEDS REAL PROOF": 21,
  FOUNDATION: 69,
  PARTIAL: 16,
  "NOT STARTED": 59,
  "EXTERNAL COVERAGE GAP": 1
});
assert.ok(capabilityRows.every((line) => line.split("|")[4]?.trim()), "every North-Star capability needs a canonical PUSH owner");

const roadmap = read("DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md");
const numbered = roadmap.slice(roadmap.indexOf("# CANONICAL NUMBERED ROADMAP"));
const pushNumbers = [...numbered.matchAll(/^\| (\d+) \|/gm)].map((match) => Number(match[1])).filter((number) => number >= 1 && number <= 52);
assert.deepEqual([...new Set(pushNumbers)].sort((a, b) => a - b), Array.from({ length: 52 }, (_, index) => index + 1));

console.log("PUSH 26 domain consolidation QA PASS: 11 canonical owners, explicit legacy/mock boundaries, canonical Event→Incident→Risk→Verification→Decision, separate Evidence/Investigation, and no Product fallback to legacy stores.");
