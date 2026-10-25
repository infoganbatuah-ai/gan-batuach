import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Local TS resolution only; no app, database or service is started.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(/\/(event-risk-fenced-writes|event-risk-recovery)\.js$/.test(specifier)
    ? specifier.replace(/\.js$/, ".ts") : specifier, context);
} });
const { acquireClaim } = await import("../../lib/domain/digital-observer/event-risk-recovery.ts");
const { compareSuppliedRiskRowForReview } =
  await import("../../lib/domain/digital-observer/event-risk-source-row-map.ts");

const scope = Object.freeze({ tenantId: "synthetic-tenant", siteId: "synthetic-site",
  sourceId: "synthetic-source", eventId: "synthetic-event", incidentId: "synthetic-incident",
  riskDecisionId: "synthetic-risk-row" });
const claim = acquireClaim({ existing: null, scope, engineVersion: "do-risk-v1",
  ownerNonce: "synthetic-owner", now: 1000, leaseMs: 100 }).claim;
const state = { claim, writeGeneration: 0, riskResult: null, effects: {},
  riskProjection: { generation: 0, latestReferenceId: null },
  verificationProjection: { generation: 0, latestReferenceId: null }, guardDispatchCount: 0 };
const context = { scope, engineVersion: "do-risk-v1", token: claim.token,
  now: 1001, expectedWriteGeneration: 0 };
const ownership = { stage: "POST_READ_RISK_SCOPE_BOUND", scope,
  authorityEvidenceRef: "synthetic-reviewed-event-attestation" };
const evaluation = { accepted: true, incidentId: scope.incidentId,
  triggeringEventId: scope.eventId, riskScore: 72, peakRiskScore: 75,
  riskBand: "HIGH", evaluationConfidence: 0.8,
  contributingFactors: [], mitigatingFactors: [], matchedRules: [],
  baselineContext: { version: "synthetic-baseline" },
  explanation: { headline: "synthetic", reasons: [], mitigations: [], uncertainty: [] },
  recommendedDecision: "VERIFY", actionIntents: ["VERIFY"], currentRiskScore: 72,
  previousRiskScore: null, riskEngineVersion: "do-risk-v1", factorVersion: "factor-v1",
  decisionVersion: "decision-v1", evaluatedAt: "2026-10-25T00:00:00.000Z",
  inputFingerprint: "a".repeat(64), decisionDedupeKey: "synthetic-dedupe" };
const row = { id: scope.riskDecisionId, observer_site_id: scope.siteId,
  incident_id: scope.incidentId, triggering_event_id: scope.eventId,
  risk_score: 72, peak_risk_score: 75, risk_band: "HIGH",
  evaluation_confidence: 0.8, contributing_factors: [], mitigating_factors: [],
  matched_rules: [], baseline_context: { version: "synthetic-baseline" },
  explanation: { headline: "synthetic", reasons: [], mitigations: [], uncertainty: [] },
  recommended_decision: "VERIFY", action_intents: ["VERIFY"],
  risk_engine_version: "do-risk-v1", factor_version: "factor-v1",
  decision_version: "decision-v1", input_fingerprint: "a".repeat(64),
  previous_evaluation_id: null, evaluated_at: "2026-10-25T00:00:00.000Z",
  metadata: { deterministic: true, no_llm: true, real_provenance_only: true,
    external_action_executed: false } };
const subject = overrides => ({ state, context, ownership, evaluation, suppliedRow: row, ...overrides });

test("source-shaped Risk row compares every supplied persisted field locally", () => {
  assert.deepEqual(compareSuppliedRiskRowForReview(subject()),
    { kind: "SOURCE_ROW_SEMANTIC_MATCH_ONLY", rowId: scope.riskDecisionId });
});
test("same Risk identity with changed semantics or missing column is rejected", () => {
  for (const column of Object.keys(row).filter(key => key !== "id")) {
    assert.throws(() => compareSuppliedRiskRowForReview(subject({ suppliedRow: {
      ...row, [column]: "synthetic-conflict"
    } })), /RISK_SOURCE_SEMANTIC_CONFLICT/, `changed ${column}`);
    const missing = { ...row };
    delete missing[column];
    assert.throws(() => compareSuppliedRiskRowForReview(subject({ suppliedRow: missing })),
      /RISK_SOURCE_SEMANTIC_CONFLICT/, `missing ${column}`);
  }
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ suppliedRow: { ...row,
    id: "another-risk-row" } })), /RISK_SOURCE_IDENTITY_CONFLICT/);
});
test("wrong Event, engine version, Site or Tenant cannot match", () => {
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ evaluation: { ...evaluation,
    triggeringEventId: "other-event" } })), /RISK_SOURCE_IDENTITY_CONFLICT/);
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ evaluation: { ...evaluation,
    riskEngineVersion: "other-engine" } })), /RISK_SOURCE_IDENTITY_CONFLICT/);
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ suppliedRow: { ...row,
    observer_site_id: "other-site" } })), /RISK_SOURCE_SEMANTIC_CONFLICT/);
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ ownership: { ...ownership,
    scope: { ...scope, tenantId: "other-tenant" } } })), /RISK_SOURCE_OWNERSHIP_UNVERIFIED/);
});
test("missing event-time authority, stale epoch and wrong previous projection fail closed", () => {
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ ownership: { ...ownership,
    stage: "PRE_PERSIST_EVENT_CHAIN_VALIDATED" } })), /RISK_SOURCE_OWNERSHIP_UNVERIFIED/);
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ ownership: { ...ownership,
    authorityEvidenceRef: "" } })), /RISK_SOURCE_OWNERSHIP_UNVERIFIED/);
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ context: { ...context,
    token: { ...claim.token, ownerEpoch: 2 } } })), /RISK_WRITE_FENCED/);
  assert.throws(() => compareSuppliedRiskRowForReview(subject({ suppliedRow: { ...row,
    previous_evaluation_id: "unrelated-risk" } })), /RISK_SOURCE_SEMANTIC_CONFLICT/);
});
