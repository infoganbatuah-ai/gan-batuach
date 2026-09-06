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

const { evaluateIncidentRisk } = await import("../../lib/domain/digital-observer/risk-decision-engine.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20260906010000_digital_observer_risk_decision_engine.sql", import.meta.url), "utf8");
const idempotencyMigration = readFileSync(new URL("../../supabase/migrations/20260906011000_digital_observer_risk_event_idempotency.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../../lib/domain/digital-observer/risk-decision-service.ts", import.meta.url), "utf8");
const incidentApi = readFileSync(new URL("../../app/api/digital-observer/incidents/route.ts", import.meta.url), "utf8");

const input = (overrides = {}) => ({
  observerSiteId: "site-a",
  incident: {
    id: "incident-a", observerSiteId: "site-a", status: "open", provenance: "REAL_CAMERA_AI",
    cameraSourceIds: ["camera-a"], trackIds: ["track-a"], relatedEventIds: ["event-a"],
    eventTypes: ["person_entered"], durationSeconds: 10
  },
  triggeringEvent: {
    id: "event-a", observerSiteId: "site-a", sourceType: "system", provenance: "REAL_CAMERA_AI",
    validated: true, eventType: "person_entered", cameraSourceId: "camera-a", streamId: "stream-a",
    trackId: "track-a", zone: "entrance", confidence: 0.98, occurredAt: "2026-09-06T09:00:00.000Z",
    recordingRequired: false, evidenceAvailable: false
  },
  context: { available: true, localTime: "2026-09-06 12:00", localDay: "sun", withinExpectedHours: true },
  baseline: {
    maturity: "LEARNING", version: "v1_real_camera_event_context", confidence: 0.2,
    expectedSignals: [], deviationSignals: [{ key: "unusual_time_of_day", reason: "insufficient history" }],
    typicalDurationSeconds: null
  },
  matchedRules: [],
  policy: { recordingAuthorized: false, inAppNotificationAllowed: true, externalEscalationEnabled: false },
  previousEvaluation: null,
  evaluatedAt: "2026-09-06T09:00:01.000Z",
  ...overrides
});

const normal = evaluateIncidentRisk(input());
assert(normal.accepted);
assert.equal(normal.riskScore, 10, "normal expected entry remains bounded");
assert.equal(normal.riskBand, "LOW");
assert.equal(normal.recommendedDecision, "LOG_ONLY");
assert(normal.explanation.uncertainty.some(item => item.includes("LEARNING")), "immature baseline is disclosed as uncertainty");
assert(!normal.contributingFactors.some(item => item.key.startsWith("baseline_")), "immature baseline cannot increase risk");

const lowerDetectionConfidence = evaluateIncidentRisk(input({ triggeringEvent: { ...input().triggeringEvent, confidence: 0.61 } }));
assert(lowerDetectionConfidence.accepted);
assert.equal(lowerDetectionConfidence.riskScore, normal.riskScore, "detection confidence must not become risk score");
assert(lowerDetectionConfidence.evaluationConfidence < normal.evaluationConfidence, "detection confidence may affect evaluation certainty only");

const offHours = evaluateIncidentRisk(input({ context: { ...input().context, localTime: "2026-09-07 02:00", withinExpectedHours: false } }));
assert(offHours.accepted && offHours.riskScore > normal.riskScore, "off-hours fact increases risk with an explicit reason");
assert(offHours.contributingFactors.some(item => item.key === "outside_expected_hours"));

const rule = {
  id: "rule-a", observerSiteId: "site-a", cameraSourceId: "camera-a", title: "כניסה מוגנת",
  priority: 9, version: "rule-v2", contribution: 20, minimumRiskScore: 75,
  minimumDecision: "NOTIFY_IN_APP", reason: "explicit structured site policy"
};
const ruled = evaluateIncidentRisk(input({ matchedRules: [rule] }));
assert(ruled.accepted && ruled.riskScore >= 75);
assert.equal(ruled.recommendedDecision, "NOTIFY_IN_APP");
assert(ruled.matchedRules.some(item => item.version === "rule-v2"));

const closedInput = input({
  incident: { ...input().incident, status: "closed", relatedEventIds: ["event-a", "event-b"], eventTypes: ["person_entered", "person_exited"], durationSeconds: 30 },
  triggeringEvent: { ...input().triggeringEvent, id: "event-b", eventType: "person_exited", occurredAt: "2026-09-06T09:00:30.000Z" },
  previousEvaluation: { riskScore: normal.riskScore, peakRiskScore: normal.peakRiskScore, riskBand: normal.riskBand },
  evaluatedAt: "2026-09-06T09:00:31.000Z"
});
const resolved = evaluateIncidentRisk(closedInput);
assert(resolved.accepted);
assert(resolved.riskScore < normal.riskScore, "normal exit can de-escalate current risk");
assert.equal(resolved.peakRiskScore, normal.riskScore, "historical peak is retained while current risk decreases");

const duplicate = evaluateIncidentRisk(input());
assert(duplicate.accepted && duplicate.inputFingerprint === normal.inputFingerprint, "duplicate recalculation is idempotent");
assert.equal(duplicate.decisionDedupeKey, normal.decisionDedupeKey, "duplicate action intent uses one cooldown key");

const mock = evaluateIncidentRisk(input({ triggeringEvent: { ...input().triggeringEvent, provenance: "SHADOW_AI" } }));
assert.deepEqual(mock, { accepted: false, reason: "UNTRUSTED_PROVENANCE" });
const foreignSite = evaluateIncidentRisk(input({ triggeringEvent: { ...input().triggeringEvent, observerSiteId: "site-b" } }));
assert.deepEqual(foreignSite, { accepted: false, reason: "SCOPE_MISMATCH" });

const missingContext = evaluateIncidentRisk(input({ context: { available: false, localTime: null, localDay: null, withinExpectedHours: null } }));
assert(missingContext.accepted && missingContext.evaluationConfidence < normal.evaluationConfidence, "missing context reduces evaluation confidence");

const privacyBound = evaluateIncidentRisk(input({
  triggeringEvent: { ...input().triggeringEvent, recordingRequired: true },
  policy: { recordingAuthorized: false, inAppNotificationAllowed: true, externalEscalationEnabled: false }
}));
assert(privacyBound.accepted && !privacyBound.actionIntents.includes("PRESERVE_EVIDENCE"), "risk cannot grant recording permission");

for (const required of [
  "digital_observer_risk_evaluations", "digital_observer_decision_intents", "input_fingerprint",
  "external_execution_enabled = false", "latest_risk_evaluation_id", "observer_site_memberships"
]) assert(migration.includes(required), `migration missing ${required}`);
for (const required of ["incident_id, triggering_event_id, risk_engine_version", "create unique index"])
  assert(idempotencyMigration.includes(required), `idempotency migration missing ${required}`);
for (const required of ["triggering_event_id", "risk_engine_version", "incident.metadata"])
  assert(service.includes(required), `risk persistence missing ${required}`);
for (const required of ["evaluateAndPersistIncidentRisk", "allowPush: false", "evaluation_confidence", "riskResult.evaluation.riskBand", "riskResult.verification.evaluation.finalDecision"])
  assert(route.includes(required), `production ingest missing ${required}`);
assert.match(incidentApi, /hasObserverAdminClaim/, "signed Digital Observer admins need a bounded risk-debug read path");
assert.match(incidentApi, /neq\("site_type", "kindergarten"\)/, "observer admin risk reads must remain outside kindergarten scope");
assert.doesNotMatch(incidentApi, /rtsp|password|credential|stream_url|access_token/i, "risk-debug response must not select media credentials or source secrets");

console.log("Digital Observer Risk/Decision checks passed: confidence separation, bounded normal risk, off-hours/rule factors, maturity guardrail, de-escalation, idempotency, provenance/scope isolation, uncertainty and privacy authority.");
