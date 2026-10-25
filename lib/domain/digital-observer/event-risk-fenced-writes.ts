import {
  assertEquivalentDecisionIntent, assertFencedProjectionWrite, beginEffects,
  completeRiskEffects, persistRiskCheckpoint, recordEffectReceipt, requiredEffectKeys,
  type CanonicalDecisionIntent, type ClaimToken, type EffectReceipt,
  type EffectsPlan, type RiskClaim, type RiskCheckpoint
} from "./event-risk-recovery.js";
import type { ResolvedModelAChain } from "./model-a-ownership";

// DISCONNECTED contract. A future database RPC must lock and change the claim,
// canonical row, projection, effect row and receipt in one PostgreSQL transaction.
// This module never contacts a database and is not imported by active ingestion.
export type FencedWriteState = Readonly<{
  claim: RiskClaim;
  writeGeneration: number;
  riskResult: RiskResultEvidence | null;
  effects: Readonly<Record<string, DurableEffectEvidence>>;
  riskProjection: ProjectionState;
  verificationProjection: ProjectionState;
  guardDispatchCount: 0;
}>;
export type ProjectionState = Readonly<{ generation: number; latestReferenceId: string | null }>;
export type RiskResultEvidence = Readonly<{
  checkpoint: RiskCheckpoint;
  scope: ResolvedModelAChain;
  engineVersion: string;
  semanticFingerprint: string;
}>;
export type DurableEffectEvidence = Readonly<{
  key: string;
  rowId: string;
  scope: ResolvedModelAChain;
  riskEvaluationId: string;
  fingerprint: string;
  recipientSnapshotDigest?: string;
  auditCommitted?: true;
  decisionIntent?: CanonicalDecisionIntent;
}>;
export type FencedWriteContext = Readonly<{
  scope: ResolvedModelAChain;
  engineVersion: string;
  token: ClaimToken;
  now: number;
  expectedWriteGeneration: number;
}>;

function sameScope(a: ResolvedModelAChain, b: ResolvedModelAChain): boolean {
  return a.tenantId === b.tenantId && a.siteId === b.siteId
    && a.sourceId === b.sourceId && a.eventId === b.eventId
    && a.incidentId === b.incidentId && a.riskDecisionId === b.riskDecisionId;
}

export function assertFencedWrite(state: FencedWriteState, context: FencedWriteContext): void {
  const claim = state.claim;
  if (!sameScope(claim.scope, context.scope) || claim.engineVersion !== context.engineVersion
    || claim.token.ownerNonce !== context.token.ownerNonce
    || claim.token.ownerEpoch !== context.token.ownerEpoch
    || !Number.isSafeInteger(context.token.ownerEpoch) || context.token.ownerEpoch < 1
    || !Number.isSafeInteger(context.now) || context.now >= claim.leaseExpiresAt
    || claim.state === "COMPLETED" || claim.state === "REVOKED"
    || !Number.isSafeInteger(context.expectedWriteGeneration)
    || context.expectedWriteGeneration !== state.writeGeneration) {
    throw new Error("RISK_WRITE_FENCED");
  }
}

function advance(state: FencedWriteState, change: Partial<FencedWriteState>): FencedWriteState {
  if (!Number.isSafeInteger(state.writeGeneration + 1)) throw new Error("RISK_WRITE_GENERATION_OVERFLOW");
  return Object.freeze({ ...state, ...change, writeGeneration: state.writeGeneration + 1 });
}

export function persistFencedRisk(state: FencedWriteState, context: FencedWriteContext,
  evidence: RiskResultEvidence): FencedWriteState {
  assertFencedWrite(state, context);
  if (!sameScope(evidence.scope, context.scope) || evidence.engineVersion !== context.engineVersion
    || !/^[a-f0-9]{64}$/.test(evidence.semanticFingerprint)
    || (context.scope.riskDecisionId && evidence.checkpoint.evaluationId !== context.scope.riskDecisionId)) {
    throw new Error("RISK_RESULT_EVIDENCE_INVALID");
  }
  if (state.riskResult && (state.riskResult.checkpoint.evaluationId !== evidence.checkpoint.evaluationId
    || state.riskResult.checkpoint.inputFingerprint !== evidence.checkpoint.inputFingerprint
    || state.riskResult.semanticFingerprint !== evidence.semanticFingerprint
    || !sameScope(state.riskResult.scope, evidence.scope))) {
    throw new Error("RISK_RESULT_SEMANTIC_CONFLICT");
  }
  const claim = persistRiskCheckpoint(state.claim, context.token, evidence.checkpoint, context.now);
  if (state.riskResult) return state;
  return advance(state, { claim, riskResult: Object.freeze({ ...evidence }) });
}

export function startFencedEffects(state: FencedWriteState, context: FencedWriteContext,
  plan: EffectsPlan): FencedWriteState {
  assertFencedWrite(state, context);
  if (!state.riskResult || !state.claim.risk) throw new Error("RISK_RESULT_NOT_DURABLE");
  const claim = beginEffects(state.claim, context.token, plan, context.now);
  if (state.claim.plan) return state;
  return advance(state, { claim });
}

function sameEvidence(a: DurableEffectEvidence, b: DurableEffectEvidence): boolean {
  if (a.key !== b.key || a.rowId !== b.rowId || a.riskEvaluationId !== b.riskEvaluationId
    || a.fingerprint !== b.fingerprint || a.recipientSnapshotDigest !== b.recipientSnapshotDigest
    || a.auditCommitted !== b.auditCommitted || !sameScope(a.scope, b.scope)) return false;
  if (a.decisionIntent || b.decisionIntent) {
    if (!a.decisionIntent || !b.decisionIntent) return false;
    try { assertEquivalentDecisionIntent(a.decisionIntent, b.decisionIntent); }
    catch { return false; }
  }
  return true;
}

export function recordFencedEffect(state: FencedWriteState, context: FencedWriteContext,
  receipt: EffectReceipt, evidence: DurableEffectEvidence,
  expectedProjection?: ProjectionState): FencedWriteState {
  assertFencedWrite(state, context);
  if (!state.claim.plan || !state.claim.risk || !requiredEffectKeys(state.claim.plan).includes(receipt.key)
    || evidence.key !== receipt.key || !evidence.rowId || !sameScope(evidence.scope, context.scope)
    || evidence.riskEvaluationId !== receipt.riskEvaluationId
    || evidence.fingerprint !== receipt.fingerprint
    || evidence.recipientSnapshotDigest !== receipt.recipientSnapshotDigest
    || ((receipt.key === "MANDATORY_DECISION_AUDIT" || receipt.key === "MEDIA_FAULT_AUDIT")
      && evidence.auditCommitted !== true)
    || (receipt.key === "DECISION_INTENT" && !evidence.decisionIntent)
    || (receipt.key !== "DECISION_INTENT" && evidence.decisionIntent)) {
    throw new Error("RISK_DURABLE_EFFECT_EVIDENCE_INVALID");
  }
  if (receipt.key === "RISK_DECISION" && evidence.rowId !== state.claim.risk.evaluationId) {
    throw new Error("RISK_DURABLE_EFFECT_EVIDENCE_INVALID");
  }
  if (evidence.decisionIntent) {
    const intent = evidence.decisionIntent;
    assertEquivalentDecisionIntent(intent, intent);
    if (intent.tenantId !== context.scope.tenantId || intent.siteId !== context.scope.siteId
      || intent.eventId !== context.scope.eventId || intent.incidentId !== context.scope.incidentId
      || intent.riskEvaluationId !== state.claim.risk.evaluationId
      || intent.recipientSettingsVersion !== state.claim.plan.recipients.settingsVersion
      || intent.recipientSnapshotDigest !== state.claim.plan.recipients.digest) {
      throw new Error("RISK_DECISION_INTENT_SCOPE_CONFLICT");
    }
  }
  const claim = recordEffectReceipt(state.claim, context.token, receipt, context.now);
  const prior = state.effects[receipt.key];
  if (prior) {
    if (!state.claim.effects[receipt.key]) throw new Error("RISK_EFFECT_RECEIPT_MISSING");
    if (!sameEvidence(prior, evidence)) throw new Error("RISK_EFFECT_SEMANTIC_CONFLICT");
    // A recovered owner can observe an identical old-epoch receipt; do not
    // re-write or increment an Incident projection for that effect.
    return state;
  }
  let projectionChange: Partial<FencedWriteState> = {};
  if (receipt.key === "INCIDENT_RISK_PROJECTION" || receipt.key === "INCIDENT_VERIFICATION_PROJECTION") {
    const field = receipt.key === "INCIDENT_RISK_PROJECTION" ? "riskProjection" : "verificationProjection";
    const current = state[field];
    if (!expectedProjection || expectedProjection.generation !== current.generation
      || expectedProjection.latestReferenceId !== current.latestReferenceId
      || !Number.isSafeInteger(current.generation + 1)) throw new Error("RISK_PROJECTION_STALE");
    assertFencedProjectionWrite(state.claim, context.token, {
      expectedGeneration: expectedProjection.generation,
      persistedGeneration: current.generation,
      expectedPreviousRiskEvaluationId: expectedProjection.latestReferenceId,
      persistedLatestRiskEvaluationId: current.latestReferenceId
    }, context.now);
    projectionChange = { [field]: Object.freeze({ generation: current.generation + 1,
      latestReferenceId: evidence.rowId }) };
  } else if (expectedProjection) throw new Error("RISK_PROJECTION_UNEXPECTED");
  return advance(state, { claim, effects: Object.freeze({ ...state.effects, [receipt.key]: Object.freeze({ ...evidence }) }),
    ...projectionChange });
}

export function completeFencedRisk(state: FencedWriteState, context: FencedWriteContext): FencedWriteState {
  assertFencedWrite(state, context);
  const claim = state.claim;
  if (!state.riskResult || !claim.plan || !claim.risk
    || requiredEffectKeys(claim.plan).some(key => {
      const receipt = claim.effects[key];
      const evidence = state.effects[key];
      return !receipt || !evidence || !evidence.rowId || receipt.fingerprint !== evidence.fingerprint
        || receipt.riskEvaluationId !== evidence.riskEvaluationId
        || !sameScope(evidence.scope, context.scope)
        || ((key === "MANDATORY_DECISION_AUDIT" || key === "MEDIA_FAULT_AUDIT")
          && evidence.auditCommitted !== true);
    })
    || state.riskProjection.latestReferenceId !== state.effects.INCIDENT_RISK_PROJECTION?.rowId
    || state.verificationProjection.latestReferenceId !== state.effects.INCIDENT_VERIFICATION_PROJECTION?.rowId) {
    throw new Error("RISK_DURABLE_EFFECTS_INCOMPLETE");
  }
  return advance(state, { claim: completeRiskEffects(claim, context.token, context.now) });
}
