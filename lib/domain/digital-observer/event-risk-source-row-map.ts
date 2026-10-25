import { isDeepStrictEqual } from "node:util";
import type { RiskEvaluation } from "./risk-decision-engine";
import type { VerifiedEventRiskOwnership } from "./event-risk-ownership-snapshot";
import { assertFencedWrite, type FencedWriteContext, type FencedWriteState } from "./event-risk-fenced-writes.js";

// DISCONNECTED source-row comparison. This is not a database reader, writer,
// transaction, ownership attestation or evidence that a row was committed.
// It is deliberately not imported by the active cloud-event route.
type RiskSourceRow = Readonly<Record<string, unknown>>;

export function compareSuppliedRiskRowForReview(input: {
  state: FencedWriteState;
  context: FencedWriteContext;
  ownership: VerifiedEventRiskOwnership;
  evaluation: RiskEvaluation;
  suppliedRow: RiskSourceRow;
}): Readonly<{ kind: "SOURCE_ROW_SEMANTIC_MATCH_ONLY"; rowId: string }> {
  const { state, context, ownership, evaluation, suppliedRow } = input;
  assertFencedWrite(state, context);
  const scope = ownership.scope;
  if (ownership.stage !== "POST_READ_RISK_SCOPE_BOUND"
    || ownership.riskEngineVersion !== context.engineVersion
    || !ownership.authorityEvidenceRef || !scope.tenantId || !scope.siteId || !scope.sourceId
    || !scope.eventId || !scope.incidentId || !scope.riskDecisionId
    || scope.tenantId !== context.scope.tenantId || scope.siteId !== context.scope.siteId
    || scope.sourceId !== context.scope.sourceId || scope.eventId !== context.scope.eventId
    || scope.incidentId !== context.scope.incidentId
    || scope.riskDecisionId !== context.scope.riskDecisionId) {
    throw new Error("RISK_SOURCE_OWNERSHIP_UNVERIFIED");
  }
  if (evaluation.accepted !== true || evaluation.incidentId !== scope.incidentId
    || evaluation.triggeringEventId !== scope.eventId
    || evaluation.riskEngineVersion !== context.engineVersion
    || !/^[a-f0-9]{64}$/.test(evaluation.inputFingerprint)
    || suppliedRow.id !== scope.riskDecisionId) {
    throw new Error("RISK_SOURCE_IDENTITY_CONFLICT");
  }
  // Exact insert payload in risk-decision-service.ts::persistRiskEvaluation.
  // The prior reference comes from the canonical Incident projection, not a
  // request field. PostgreSQL numeric/jsonb serialization remains unqualified.
  const expected: RiskSourceRow = {
    observer_site_id: scope.siteId,
    incident_id: scope.incidentId,
    triggering_event_id: scope.eventId,
    risk_score: evaluation.riskScore,
    peak_risk_score: evaluation.peakRiskScore,
    risk_band: evaluation.riskBand,
    evaluation_confidence: evaluation.evaluationConfidence,
    contributing_factors: evaluation.contributingFactors,
    mitigating_factors: evaluation.mitigatingFactors,
    matched_rules: evaluation.matchedRules,
    baseline_context: evaluation.baselineContext,
    explanation: evaluation.explanation,
    recommended_decision: evaluation.recommendedDecision,
    action_intents: evaluation.actionIntents,
    risk_engine_version: evaluation.riskEngineVersion,
    factor_version: evaluation.factorVersion,
    decision_version: evaluation.decisionVersion,
    input_fingerprint: evaluation.inputFingerprint,
    previous_evaluation_id: state.riskProjection.latestReferenceId,
    evaluated_at: evaluation.evaluatedAt,
    metadata: { deterministic: true, no_llm: true, real_provenance_only: true, external_action_executed: false }
  };
  for (const [column, value] of Object.entries(expected)) {
    if (!Object.hasOwn(suppliedRow, column) || !isDeepStrictEqual(suppliedRow[column], value)) {
      throw new Error("RISK_SOURCE_SEMANTIC_CONFLICT");
    }
  }
  return Object.freeze({ kind: "SOURCE_ROW_SEMANTIC_MATCH_ONLY", rowId: scope.riskDecisionId });
}
