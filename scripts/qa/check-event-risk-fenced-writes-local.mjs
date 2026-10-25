import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import {
  acquireClaim, freezeRecipientSnapshot, requiredEffectKeys
} from "../../lib/domain/digital-observer/event-risk-recovery.ts";
// Next/TypeScript resolves .js source specifiers to .ts. Native Node TS
// stripping does not, so adapt this one test import without touching tsconfig.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.endsWith("/event-risk-recovery.js")
    ? specifier.replace(/\.js$/, ".ts") : specifier, context);
} });
const {
  completeFencedRisk, persistFencedRisk, recordFencedEffect, startFencedEffects
} = await import("../../lib/domain/digital-observer/event-risk-fenced-writes.ts");

// Deterministic, transactional IN-MEMORY test double. Neither its queue nor
// snapshots prove PostgreSQL locks, process crash durability, RLS or an RPC.
const scope = Object.freeze({ tenantId: "tenant-a", siteId: "site-a", sourceId: "source-a",
  eventId: "event-a", incidentId: "incident-a", riskDecisionId: "risk-a" });
const fingerprint = "a".repeat(64);
const semanticFingerprint = "b".repeat(64);
const now = 1_000_000;
const engineVersion = "do-risk-v1";
const recipients = freezeRecipientSnapshot("settings-v1", ["owner-a"]);
const basePlan = { watchRuleIds: ["watch-a"], recipients, mediaFaultAuditRequired: false };
const plan = Object.freeze({ ...basePlan,
  expectedFingerprints: Object.fromEntries(requiredEffectKeys(basePlan).map(key => [key, `fp:${key}`])) });
const risk = { checkpoint: { evaluationId: "risk-a", inputFingerprint: fingerprint },
  scope, engineVersion, semanticFingerprint };

function initial() {
  const result = acquireClaim({ existing: null, scope, engineVersion,
    ownerNonce: "owner-a", now, leaseMs: 100 });
  assert.equal(result.kind, "ACQUIRED");
  return { claim: result.claim, writeGeneration: 0, riskResult: null, effects: {},
    riskProjection: { generation: 0, latestReferenceId: null },
    verificationProjection: { generation: 0, latestReferenceId: null }, guardDispatchCount: 0 };
}
function context(state, override = {}) {
  return { scope, engineVersion, token: state.claim.token, now: now + 1,
    expectedWriteGeneration: state.writeGeneration, ...override };
}
function intent() {
  return { tenantId: scope.tenantId, siteId: scope.siteId, eventId: scope.eventId,
    incidentId: scope.incidentId, riskEvaluationId: "risk-a", verificationId: "verification-a",
    decision: "REVIEW", intentType: "risk-review", payloadVersion: "1",
    dedupeKey: "intent-a", idempotencyKey: "intent-a", cooldownUntil: "2030-01-01T00:00:00Z",
    recipientSettingsVersion: recipients.settingsVersion, recipientSnapshotDigest: recipients.digest,
    requiredEvidenceReferences: ["evidence-a"], requiresHumanReview: true,
    externalExecutionEnabled: false, verificationVersion: "v1", finalDecisionVersion: "v1",
    finalDecisionConfidence: 0.7, decisionStage: "post_verification_final",
    privacyPolicyAuthoritative: true };
}
function effect(state, key, overrides = {}) {
  const recipientSnapshotDigest = key === "RECIPIENT_PLAN" || key.startsWith("IN_APP_JOURNAL:")
    ? recipients.digest : undefined;
  const rowId = key === "RISK_DECISION" || key === "INCIDENT_RISK_PROJECTION" ? "risk-a"
    : key === "INCIDENT_VERIFICATION_PROJECTION" ? "verification-a" : `row:${key}`;
  const receipt = { key, tenantId: scope.tenantId, siteId: scope.siteId,
    eventId: scope.eventId, ownerEpoch: state.claim.token.ownerEpoch,
    riskEvaluationId: "risk-a", fingerprint: plan.expectedFingerprints[key],
    ...(recipientSnapshotDigest ? { recipientSnapshotDigest } : {}) };
  const evidence = { key, rowId, scope, riskEvaluationId: "risk-a",
    fingerprint: receipt.fingerprint,
    ...(recipientSnapshotDigest ? { recipientSnapshotDigest } : {}),
    ...(key === "MANDATORY_DECISION_AUDIT" ? { auditCommitted: true } : {}),
    ...(key === "DECISION_INTENT" ? { decisionIntent: intent() } : {}), ...overrides };
  return { receipt, evidence };
}
function record(state, key, overrides = {}, expectedProjection) {
  const { receipt, evidence } = effect(state, key, overrides);
  const projection = expectedProjection ?? (key === "INCIDENT_RISK_PROJECTION" ? state.riskProjection
    : key === "INCIDENT_VERIFICATION_PROJECTION" ? state.verificationProjection : undefined);
  return recordFencedEffect(state, context(state), receipt, evidence, projection);
}
function ready() {
  let state = initial();
  state = persistFencedRisk(state, context(state), risk);
  return startFencedEffects(state, context(state), plan);
}
function allEffects(state) {
  for (const key of requiredEffectKeys(plan)) state = record(state, key);
  return state;
}
class SyntheticTransactionStore {
  #state;
  #queue = Promise.resolve();
  constructor(state = initial()) { this.#state = structuredClone(state); }
  snapshot() { return structuredClone(this.#state); }
  transact(callback) {
    const run = async () => {
      const candidate = structuredClone(this.#state);
      const next = await callback(candidate);
      this.#state = structuredClone(next);
      return this.snapshot();
    };
    const operation = this.#queue.then(run);
    this.#queue = operation.catch(() => {});
    return operation;
  }
}

test("four writes are fenced, atomic in the synthetic store and complete only after durable evidence", async () => {
  const store = new SyntheticTransactionStore();
  await store.transact(s => persistFencedRisk(s, context(s), risk));
  await store.transact(s => startFencedEffects(s, context(s), plan));
  await assert.rejects(store.transact(s => completeFencedRisk(s, context(s))), /INCOMPLETE/);
  for (const key of requiredEffectKeys(plan)) await store.transact(s => record(s, key));
  const completed = await store.transact(s => completeFencedRisk(s, context(s)));
  assert.equal(completed.claim.state, "COMPLETED");
  assert.equal(completed.guardDispatchCount, 0);
  assert.equal(Object.keys(completed.effects).length, requiredEffectKeys(plan).length);
  await assert.rejects(store.transact(s => completeFencedRisk(s, context(s))), /FENCED/);
});

test("rollback, crash windows and recovery keep persisted risk and missing effects", async () => {
  const store = new SyntheticTransactionStore();
  await assert.rejects(store.transact(s => {
    persistFencedRisk(s, context(s), risk);
    throw new Error("SIMULATED_CRASH_BEFORE_COMMIT");
  }), /SIMULATED_CRASH/);
  assert.equal(store.snapshot().riskResult, null);
  await store.transact(s => persistFencedRisk(s, context(s), risk));
  const afterRestart = new SyntheticTransactionStore(store.snapshot());
  const reused = await afterRestart.transact(s => persistFencedRisk(s, context(s), risk));
  assert.equal(reused.writeGeneration, 1);
  await afterRestart.transact(s => startFencedEffects(s, context(s), plan));
  await afterRestart.transact(s => record(s, "MANDATORY_DECISION_AUDIT"));
  await assert.rejects(afterRestart.transact(s => {
    record(s, "DECISION_INTENT", { rowId: "intent-a" });
    throw new Error("SIMULATED_CRASH_MID_EFFECT");
  }), /SIMULATED_CRASH/);
  assert.equal(afterRestart.snapshot().effects.DECISION_INTENT, undefined);
  const resumed = new SyntheticTransactionStore(afterRestart.snapshot());
  let state = resumed.snapshot();
  state = allEffects(state);
  assert.equal(state.effects.MANDATORY_DECISION_AUDIT.rowId, "row:MANDATORY_DECISION_AUDIT");
  const final = completeFencedRisk(state, context(state));
  assert.equal(final.claim.state, "COMPLETED");
});

test("stale epoch, expired lease, wrong scope and concurrent snapshot reject writes", async () => {
  let state = ready();
  const stale = context(state);
  state = record(state, "EVENT_INCIDENT_LINK");
  assert.throws(() => recordFencedEffect(state, stale, ...Object.values(effect(state, "RISK_DECISION"))), /FENCED/);
  assert.throws(() => persistFencedRisk(state, context(state, { now: now + 100 }), risk), /FENCED/);
  assert.throws(() => startFencedEffects(state, context(state, { scope: { ...scope, siteId: "site-b" } }), plan), /FENCED/);
  const recovered = acquireClaim({ existing: { ...state.claim, leaseExpiresAt: now + 2 }, scope,
    engineVersion, ownerNonce: "owner-b", now: now + 3, leaseMs: 100 });
  assert.equal(recovered.kind, "RECOVERED");
  assert.equal(recovered.claim.token.ownerEpoch, 2);
  state = { ...state, claim: recovered.claim };
  assert.throws(() => completeFencedRisk(state, stale), /FENCED/);
  assert.equal(record(state, "EVENT_INCIDENT_LINK").writeGeneration, state.writeGeneration);
});

test("semantic conflicts, audit failure, recipient drift and stale projections fail closed", () => {
  let state = ready();
  assert.throws(() => persistFencedRisk(state, context(state),
    { ...risk, semanticFingerprint: "c".repeat(64) }), /SEMANTIC_CONFLICT/);
  assert.throws(() => record(state, "MANDATORY_DECISION_AUDIT", { auditCommitted: undefined }), /EVIDENCE_INVALID/);
  assert.throws(() => record(state, "RECIPIENT_PLAN", { recipientSnapshotDigest: "new-settings" }), /EVIDENCE_INVALID/);
  assert.throws(() => record(state, "INCIDENT_RISK_PROJECTION", {},
    { generation: 9, latestReferenceId: null }), /PROJECTION_STALE/);
  state = record(state, "DECISION_INTENT");
  assert.throws(() => record(state, "DECISION_INTENT", { decisionIntent: { ...intent(), decision: "ALLOW" } }),
    /SEMANTIC_CONFLICT/);
  assert.equal(state.guardDispatchCount, 0);
});

test("a second independent owner cannot mutate one live claim; no active adapter is imported", async () => {
  const store = new SyntheticTransactionStore();
  const contested = await Promise.allSettled([store.transact(s => persistFencedRisk(s, context(s), risk)),
    store.transact(s => persistFencedRisk(s, context(s, { token: { ownerNonce: "owner-b", ownerEpoch: 1 } }), risk))]);
  assert.equal(contested[0].status, "fulfilled");
  assert.equal(contested[0].value.claim.state, "RISK_PERSISTED");
  assert.equal(contested[1].status, "rejected");
  assert.match(contested[1].reason.message, /FENCED/);
  assert.equal(store.snapshot().writeGeneration, 1);
});
