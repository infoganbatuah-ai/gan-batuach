import { createHash } from "node:crypto";
import type { ResolvedModelAChain } from "./model-a-ownership";

// Pure local contract only. Atomicity and durability require a future reviewed
// PostgreSQL implementation; this module is not imported by the ingest route.
export type ClaimState = "CLAIMED" | "RISK_PERSISTED" | "EFFECTS_PENDING" | "COMPLETED" | "REVOKED";
export type ClaimToken = Readonly<{ ownerNonce: string; ownerEpoch: number }>;
export type RiskCheckpoint = Readonly<{ evaluationId: string; inputFingerprint: string }>;
export type RecipientSnapshot = Readonly<{
  settingsVersion: string;
  recipientIds: readonly string[];
  digest: string;
}>;
export type EffectsPlan = Readonly<{
  watchRuleIds: readonly string[];
  recipients: RecipientSnapshot;
  mediaFaultAuditRequired: boolean;
  expectedFingerprints: Readonly<Record<string, string>>;
}>;
export type EffectReceipt = Readonly<{
  key: string;
  tenantId: string;
  siteId: string;
  eventId: string;
  ownerEpoch: number;
  riskEvaluationId: string;
  fingerprint: string;
  recipientSnapshotDigest?: string;
}>;
export type RiskClaim = Readonly<{
  scope: ResolvedModelAChain;
  engineVersion: string;
  state: ClaimState;
  token: ClaimToken;
  leaseExpiresAt: number;
  risk: RiskCheckpoint | null;
  plan: EffectsPlan | null;
  effects: Readonly<Record<string, EffectReceipt>>;
}>;

/** Future adapter: each mutation MUST revalidate canonical Tenant/Site/Event,
 * lock the claim and affected rows, and fence in one database transaction. */
export interface DurableRiskClaimStore {
  acquire(scope: ResolvedModelAChain, engineVersion: string, ownerNonce: string, now: number): Promise<AcquireResult>;
  renew(claim: RiskClaim, token: ClaimToken, now: number): Promise<RiskClaim>;
  inspect(scope: ResolvedModelAChain, engineVersion: string): Promise<RiskClaim | null>;
  persistRisk(claim: RiskClaim, token: ClaimToken, risk: RiskCheckpoint, now: number): Promise<RiskClaim>;
  recordEffect(claim: RiskClaim, token: ClaimToken, receipt: EffectReceipt, now: number): Promise<RiskClaim>;
  complete(claim: RiskClaim, token: ClaimToken, now: number): Promise<RiskClaim>;
  revoke(claim: RiskClaim): Promise<RiskClaim>;
}

export const eventRiskAdapterEnabled = false as const;
export function unavailableDurableRiskStore(): never {
  throw new Error("EVENT_RISK_DURABLE_ADAPTER_DISABLED");
}

const MAX_LEASE_MS = 5 * 60_000;
function validLease(ms: number) {
  if (!Number.isSafeInteger(ms) || ms <= 0 || ms > MAX_LEASE_MS) throw new Error("RISK_LEASE_INVALID");
}
function sameScope(left: ResolvedModelAChain, right: ResolvedModelAChain) {
  return left.tenantId === right.tenantId && left.siteId === right.siteId
    && left.sourceId === right.sourceId && left.eventId === right.eventId
    && left.incidentId === right.incidentId;
}
function current(claim: RiskClaim, token: ClaimToken, now: number) {
  if (claim.state === "REVOKED" || claim.state === "COMPLETED"
    || claim.token.ownerNonce !== token.ownerNonce || claim.token.ownerEpoch !== token.ownerEpoch
    || !Number.isSafeInteger(now) || !Number.isSafeInteger(claim.leaseExpiresAt)
    || now >= claim.leaseExpiresAt) {
    throw new Error("RISK_OWNER_FENCED_OR_EXPIRED");
  }
}

export type AcquireResult =
  | Readonly<{ kind: "ACQUIRED" | "RECOVERED"; claim: RiskClaim; calculateRisk: boolean }>
  | Readonly<{ kind: "BUSY" | "COMPLETED"; claim: RiskClaim }>;

export function acquireClaim(input: {
  existing: RiskClaim | null;
  scope: ResolvedModelAChain;
  engineVersion: string;
  ownerNonce: string;
  now: number;
  leaseMs: number;
}): AcquireResult {
  validLease(input.leaseMs);
  if (!input.engineVersion || !input.ownerNonce || !Number.isSafeInteger(input.now)
    || !input.scope.tenantId || !input.scope.siteId) throw new Error("RISK_CLAIM_INVALID");
  const existing = input.existing;
  if (!existing) return { kind: "ACQUIRED", calculateRisk: true, claim: Object.freeze({
    scope: input.scope, engineVersion: input.engineVersion, state: "CLAIMED",
    token: { ownerNonce: input.ownerNonce, ownerEpoch: 1 },
    leaseExpiresAt: input.now + input.leaseMs, risk: null, plan: null, effects: {}
  }) };
  if (!sameScope(existing.scope, input.scope) || existing.engineVersion !== input.engineVersion) {
    throw new Error("RISK_CLAIM_SCOPE_CONFLICT");
  }
  if (!Number.isSafeInteger(existing.leaseExpiresAt)
    || !Number.isSafeInteger(existing.token.ownerEpoch) || existing.token.ownerEpoch < 1
    || !existing.token.ownerNonce) throw new Error("RISK_CLAIM_CORRUPT");
  if (existing.state === "REVOKED") throw new Error("RISK_CLAIM_REVOKED");
  if (existing.state === "COMPLETED") return { kind: "COMPLETED", claim: existing };
  if (input.now < existing.leaseExpiresAt) return { kind: "BUSY", claim: existing };
  if (input.ownerNonce === existing.token.ownerNonce) throw new Error("RISK_RECOVERY_NONCE_REUSED");
  const recovered = Object.freeze({ ...existing,
    token: { ownerNonce: input.ownerNonce, ownerEpoch: existing.token.ownerEpoch + 1 },
    leaseExpiresAt: input.now + input.leaseMs
  });
  return { kind: "RECOVERED", claim: recovered, calculateRisk: recovered.risk === null };
}

export function renewClaim(claim: RiskClaim, token: ClaimToken, now: number, leaseMs: number): RiskClaim {
  current(claim, token, now);
  validLease(leaseMs);
  return Object.freeze({ ...claim, leaseExpiresAt: now + leaseMs });
}

export function persistRiskCheckpoint(claim: RiskClaim, token: ClaimToken, risk: RiskCheckpoint, now: number): RiskClaim {
  current(claim, token, now);
  if (!risk.evaluationId || !/^[a-f0-9]{64}$/.test(risk.inputFingerprint)
    || (claim.scope.riskDecisionId && claim.scope.riskDecisionId !== risk.evaluationId)) {
    throw new Error("RISK_RESULT_INVALID");
  }
  if (claim.risk) {
    if (claim.risk.evaluationId !== risk.evaluationId || claim.risk.inputFingerprint !== risk.inputFingerprint) {
      throw new Error("RISK_RESULT_CONFLICT");
    }
    return claim;
  }
  if (claim.state !== "CLAIMED") throw new Error("RISK_TRANSITION_INVALID");
  return Object.freeze({ ...claim, state: "RISK_PERSISTED" as const, risk: Object.freeze({ ...risk }) });
}

export function freezeRecipientSnapshot(settingsVersion: string, recipientIds: readonly string[]): RecipientSnapshot {
  if (!settingsVersion || recipientIds.some(id => !id)) throw new Error("RECIPIENT_SNAPSHOT_INVALID");
  const ids = Object.freeze([...new Set(recipientIds)].sort());
  const digest = createHash("sha256").update(JSON.stringify([settingsVersion, ids])).digest("hex");
  return Object.freeze({ settingsVersion, recipientIds: ids, digest });
}

function samePlan(left: EffectsPlan, right: EffectsPlan) {
  const fingerprints = (value: EffectsPlan) => Object.entries(value.expectedFingerprints)
    .sort(([a], [b]) => a.localeCompare(b));
  return left.recipients.digest === right.recipients.digest
    && left.mediaFaultAuditRequired === right.mediaFaultAuditRequired
    && JSON.stringify(left.watchRuleIds) === JSON.stringify(right.watchRuleIds)
    && JSON.stringify(fingerprints(left)) === JSON.stringify(fingerprints(right));
}
export function beginEffects(claim: RiskClaim, token: ClaimToken, plan: EffectsPlan, now: number): RiskClaim {
  current(claim, token, now);
  const canonicalRecipients = freezeRecipientSnapshot(plan.recipients.settingsVersion, plan.recipients.recipientIds);
  const expectedKeys = requiredEffectKeys(plan);
  const actualKeys = Object.keys(plan.expectedFingerprints).sort();
  if (!claim.risk || !plan.recipients.digest || !plan.recipients.settingsVersion
    || canonicalRecipients.digest !== plan.recipients.digest
    || plan.watchRuleIds.some(id => !id) || new Set(plan.watchRuleIds).size !== plan.watchRuleIds.length
    || JSON.stringify(actualKeys) !== JSON.stringify([...expectedKeys].sort())
    || actualKeys.some(key => !plan.expectedFingerprints[key])) {
    throw new Error("RISK_EFFECT_PLAN_INVALID");
  }
  if (claim.plan && !samePlan(claim.plan, plan)) throw new Error("RISK_EFFECT_PLAN_CHANGED");
  if (claim.plan) return claim;
  return Object.freeze({ ...claim, state: "EFFECTS_PENDING" as const,
    plan: Object.freeze({ ...plan, recipients: canonicalRecipients,
      watchRuleIds: Object.freeze([...plan.watchRuleIds]),
      expectedFingerprints: Object.freeze({ ...plan.expectedFingerprints }) }) });
}

export function requiredEffectKeys(plan: EffectsPlan): readonly string[] {
  return ["EVENT_INCIDENT_LINK", "RISK_DECISION", ...plan.watchRuleIds.map(id => `WATCH_RULE:${id}`),
    "INCIDENT_RISK_PROJECTION", "VERIFICATION_RESULT", "DECISION_INTENT",
    "INCIDENT_VERIFICATION_PROJECTION", "RECIPIENT_PLAN",
    ...plan.recipients.recipientIds.map(id => `IN_APP_JOURNAL:${id}`),
    "MANDATORY_DECISION_AUDIT",
    ...(plan.mediaFaultAuditRequired ? ["MEDIA_FAULT_AUDIT"] : []), "GUARD_ELIGIBILITY"];
}

export function recordEffectReceipt(claim: RiskClaim, token: ClaimToken, receipt: EffectReceipt, now: number): RiskClaim {
  current(claim, token, now);
  if (claim.state !== "EFFECTS_PENDING" || !claim.plan || !claim.risk
    || !requiredEffectKeys(claim.plan).includes(receipt.key)
    || receipt.tenantId !== claim.scope.tenantId || receipt.siteId !== claim.scope.siteId
    || receipt.eventId !== claim.scope.eventId
    || receipt.ownerEpoch !== token.ownerEpoch || receipt.riskEvaluationId !== claim.risk.evaluationId
    || !receipt.fingerprint || receipt.fingerprint !== claim.plan.expectedFingerprints[receipt.key]) {
    throw new Error("RISK_EFFECT_REJECTED");
  }
  if ((receipt.key === "RECIPIENT_PLAN" || receipt.key.startsWith("IN_APP_JOURNAL:"))
    && receipt.recipientSnapshotDigest !== claim.plan.recipients.digest) {
    throw new Error("RISK_RECIPIENT_SNAPSHOT_CONFLICT");
  }
  const prior = claim.effects[receipt.key];
  if (prior && (prior.fingerprint !== receipt.fingerprint
    || prior.recipientSnapshotDigest !== receipt.recipientSnapshotDigest)) throw new Error("RISK_EFFECT_CONFLICT");
  if (prior) return claim;
  return Object.freeze({ ...claim, effects: Object.freeze({ ...claim.effects, [receipt.key]: Object.freeze({ ...receipt }) }) });
}

/** Risk/Incident effects only; not a Gateway ACK or permission to dispatch Guard. */
export function completeRiskEffects(claim: RiskClaim, token: ClaimToken, now: number): RiskClaim {
  current(claim, token, now);
  if (claim.state !== "EFFECTS_PENDING" || !claim.plan || !claim.risk
    || requiredEffectKeys(claim.plan).some(key => {
      const receipt = claim.effects[key];
      return !receipt || receipt.key !== key || receipt.tenantId !== claim.scope.tenantId
        || receipt.siteId !== claim.scope.siteId || receipt.eventId !== claim.scope.eventId
        || !Number.isSafeInteger(receipt.ownerEpoch) || receipt.ownerEpoch < 1
        || receipt.ownerEpoch > token.ownerEpoch
        || receipt.riskEvaluationId !== claim.risk?.evaluationId
        || receipt.fingerprint !== claim.plan?.expectedFingerprints[key]
        || ((key === "RECIPIENT_PLAN" || key.startsWith("IN_APP_JOURNAL:"))
          && receipt.recipientSnapshotDigest !== claim.plan?.recipients.digest);
    })) {
    throw new Error("RISK_EFFECTS_INCOMPLETE");
  }
  return Object.freeze({ ...claim, state: "COMPLETED" as const });
}

export function assertFencedProjectionWrite(claim: RiskClaim, token: ClaimToken,
  projection: Readonly<{
    expectedGeneration: number;
    persistedGeneration: number;
    expectedPreviousRiskEvaluationId: string | null;
    persistedLatestRiskEvaluationId: string | null;
  }>, now: number): void {
  current(claim, token, now);
  if (!claim.risk || !Number.isSafeInteger(projection.expectedGeneration)
    || projection.expectedGeneration < 0 || projection.persistedGeneration !== projection.expectedGeneration
    || projection.persistedLatestRiskEvaluationId !== projection.expectedPreviousRiskEvaluationId) {
    throw new Error("RISK_PROJECTION_STALE");
  }
  // Epoch fences this Event claim. An Incident-wide generation/CAS fences
  // *other Events and engine versions*. Both must be checked under a DB lock.
}

export function inspectClaimState(claim: RiskClaim, now: number): ClaimState | "EXPIRED" {
  if (claim.state === "REVOKED" || claim.state === "COMPLETED") return claim.state;
  return now >= claim.leaseExpiresAt ? "EXPIRED" : claim.state;
}

export function revokeClaim(claim: RiskClaim, token: ClaimToken, now: number): RiskClaim {
  current(claim, token, now);
  return Object.freeze({ ...claim, state: "REVOKED" as const,
    token: { ownerNonce: token.ownerNonce, ownerEpoch: token.ownerEpoch + 1 } });
}

export type CanonicalDecisionIntent = Readonly<{
  tenantId: string; siteId: string; eventId: string; incidentId: string;
  riskEvaluationId: string; verificationId: string;
  decision: string; intentType: string; payloadVersion: string;
  dedupeKey: string; idempotencyKey: string; cooldownUntil: string;
  recipientSettingsVersion: string; recipientSnapshotDigest: string;
  requiredEvidenceReferences: readonly string[];
  requiresHumanReview: boolean; externalExecutionEnabled: false;
  verificationVersion: string; finalDecisionVersion: string;
  finalDecisionConfidence: number; decisionStage: "post_verification_final";
  privacyPolicyAuthoritative: true;
}>;

/** Call after a 23505 reread; the error code itself proves nothing. */
export function assertEquivalentDecisionIntent(expected: CanonicalDecisionIntent,
  persisted: CanonicalDecisionIntent): void {
  const valid = (value: CanonicalDecisionIntent) =>
    [value.tenantId, value.siteId, value.eventId, value.incidentId,
      value.riskEvaluationId, value.verificationId, value.intentType,
      value.payloadVersion, value.dedupeKey, value.idempotencyKey,
      value.recipientSettingsVersion].every(item => typeof item === "string" && item.length > 0)
    && typeof value.recipientSnapshotDigest === "string"
    && /^[a-f0-9]{64}$/.test(value.recipientSnapshotDigest)
    && Array.isArray(value.requiredEvidenceReferences)
    && value.requiredEvidenceReferences.every(item => typeof item === "string" && item.length > 0)
    && new Set(value.requiredEvidenceReferences).size === value.requiredEvidenceReferences.length
    && value.externalExecutionEnabled === false
    && value.decisionStage === "post_verification_final"
    && value.privacyPolicyAuthoritative === true;
  if (!valid(expected) || !valid(persisted)) throw new Error("DECISION_INTENT_INVALID");
  for (const key of ["tenantId", "siteId", "eventId", "incidentId", "riskEvaluationId",
    "verificationId", "decision", "intentType", "payloadVersion", "dedupeKey",
    "idempotencyKey", "cooldownUntil", "recipientSettingsVersion", "recipientSnapshotDigest",
    "requiresHumanReview", "externalExecutionEnabled",
    "verificationVersion", "finalDecisionVersion", "finalDecisionConfidence",
    "decisionStage", "privacyPolicyAuthoritative"] as const) {
    if (expected[key] !== persisted[key]) throw new Error("DECISION_INTENT_CONFLICT");
  }
  const canonicalReferences = (value: readonly string[]) => JSON.stringify([...value].sort());
  if (canonicalReferences(expected.requiredEvidenceReferences)
    !== canonicalReferences(persisted.requiredEvidenceReferences)) {
    throw new Error("DECISION_INTENT_CONFLICT");
  }
}
