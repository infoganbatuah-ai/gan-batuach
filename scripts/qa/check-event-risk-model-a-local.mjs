import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveModelAChain
} from "../../lib/domain/digital-observer/model-a-ownership.ts";
import {
  acquireClaim, assertEquivalentDecisionIntent, assertFencedProjectionWrite,
  beginEffects, completeRiskEffects, eventRiskAdapterEnabled,
  freezeRecipientSnapshot, inspectClaimState, persistRiskCheckpoint,
  recordEffectReceipt, renewClaim, requiredEffectKeys, revokeClaim,
  unavailableDurableRiskStore
} from "../../lib/domain/digital-observer/event-risk-recovery.ts";

// NON-DURABLE deterministic test double. It proves local transition behavior,
// not PostgreSQL transactions, cross-process concurrency or crash recovery.
const now = 1_000_000;
const fingerprint = "a".repeat(64);
const principal = { tenantId: "tenant-a", siteId: "site-a", lifecycleState: "ACTIVE" };
const reader = {
  async site(id) { return ({ "site-a": { siteId: id, tenantId: "tenant-a", siteType: "home", gardenId: null },
    "site-b": { siteId: id, tenantId: "tenant-a", siteType: "business", gardenId: null },
    "site-c": { siteId: id, tenantId: "tenant-c", siteType: "home", gardenId: null } })[id] ?? null; },
  async source(id) { return ({ "source-a": { id, siteId: "site-a", externalSourceId: "CH1" },
    "source-b": { id, siteId: "site-b", externalSourceId: "CH1" },
    "source-c": { id, siteId: "site-c", externalSourceId: "CH1" } })[id] ?? null; },
  async event(id) { return ({ "event-a": { id, siteId: "site-a", sourceId: "source-a", incidentId: "incident-a" },
    "event-b": { id, siteId: "site-b", sourceId: "source-b", incidentId: "incident-b" },
    "event-c": { id, siteId: "site-c", sourceId: "source-c", incidentId: "incident-c" } })[id] ?? null; },
  async incident(id) { return ({ "incident-a": { id, siteId: "site-a", eventIds: ["event-a"] },
    "incident-b": { id, siteId: "site-b", eventIds: ["event-b"] },
    "incident-c": { id, siteId: "site-c", eventIds: ["event-c"] } })[id] ?? null; },
  async riskDecision(id) { return ({ "risk-a": { id, siteId: "site-a", eventId: "event-a",
    incidentId: "incident-a", riskEngineVersion: "do-risk-v1" } })[id] ?? null; }
};
const requestA = { reader, principal, sourceId: "source-a", eventId: "event-a",
  incidentId: "incident-a", riskDecisionId: "risk-a", expectedRiskEngineVersion: "do-risk-v1" };
const scopeA = { tenantId: "tenant-a", siteId: "site-a", sourceId: "source-a",
  eventId: "event-a", incidentId: "incident-a", riskDecisionId: "risk-a" };
const tokenA = { ownerNonce: "worker-a", ownerEpoch: 1 };

function claim(scope = scopeA, engineVersion = "do-risk-v1") {
  const result = acquireClaim({ existing: null, scope, engineVersion,
    ownerNonce: "worker-a", now, leaseMs: 100 });
  assert.equal(result.kind, "ACQUIRED");
  return result.claim;
}
function riskPersisted(value = claim(), token = tokenA, at = now + 1) {
  return persistRiskCheckpoint(value, token, { evaluationId: "risk-a", inputFingerprint: fingerprint }, at);
}
function plan(recipientIds = ["owner-1"], mediaFaultAuditRequired = false) {
  const recipients = freezeRecipientSnapshot("settings-v1", recipientIds);
  const base = { watchRuleIds: ["rule-1"], recipients, mediaFaultAuditRequired };
  const expectedFingerprints = Object.fromEntries(requiredEffectKeys(base).map(key => [key, `fp:${key}`]));
  return { ...base, expectedFingerprints };
}
function receipt(key, value, token = tokenA) {
  return { key, tenantId: value.scope.tenantId, siteId: value.scope.siteId,
    eventId: value.scope.eventId, ownerEpoch: token.ownerEpoch, riskEvaluationId: value.risk.evaluationId,
    fingerprint: value.plan.expectedFingerprints[key],
    ...(key === "RECIPIENT_PLAN" || key.startsWith("IN_APP_JOURNAL:")
      ? { recipientSnapshotDigest: value.plan.recipients.digest } : {}) };
}

test("Model A resolves canonical Tenant → Site → Source → Event → Incident → Risk", async () => {
  const first = await resolveModelAChain(requestA);
  const second = await resolveModelAChain({ reader, principal: { ...principal, siteId: "site-b" },
    sourceId: "source-b", eventId: "event-b", incidentId: "incident-b" });
  assert.equal(first.tenantId, second.tenantId);
  assert.notEqual(first.siteId, second.siteId);
  assert.equal((await reader.source("source-a")).externalSourceId,
    (await reader.source("source-c")).externalSourceId);
  const third = await resolveModelAChain({ reader,
    principal: { ...principal, tenantId: "tenant-c", siteId: "site-c" },
    sourceId: "source-c", eventId: "event-c", incidentId: "incident-c" });
  assert.equal(third.tenantId, "tenant-c");
  assert.notEqual(third.sourceId, first.sourceId);
  await assert.rejects(resolveModelAChain({ ...requestA, principal: { ...principal, siteId: "site-c", tenantId: "tenant-c" } }),
    /OWNERSHIP_CHAIN_MISMATCH/);
  await assert.rejects(resolveModelAChain({ ...requestA, incidentId: "incident-b" }), /OWNERSHIP_CHAIN_MISMATCH/);
  await assert.rejects(resolveModelAChain({ ...requestA, clientTenantId: "tenant-c" }), /CLIENT_SCOPE_MISMATCH/);
  await assert.rejects(resolveModelAChain({ ...requestA, clientSiteId: "site-b" }), /CLIENT_SCOPE_MISMATCH/);
  await assert.rejects(resolveModelAChain({ ...requestA, principal: { ...principal, tenantId: null } }), /PRINCIPAL_SCOPE_UNVERIFIED/);
  await assert.rejects(resolveModelAChain({ ...requestA, reader: { ...reader, site: async () => null } }), /SITE_TENANT_UNVERIFIED/);
  await assert.rejects(resolveModelAChain({ ...requestA, reader: { ...reader,
    site: async id => ({ siteId: id, tenantId: null, siteType: "home", gardenId: null }) } }), /SITE_TENANT_UNVERIFIED/);
});

test("only one synthetic worker owns a live claim; expiry fences the old worker", async () => {
  // Atomic synchronous Map mutation is only a deterministic local test double.
  const rows = new Map();
  async function attempt(nonce, at) {
    const result = acquireClaim({ existing: rows.get("event-a") ?? null, scope: scopeA,
      engineVersion: "do-risk-v1", ownerNonce: nonce, now: at, leaseMs: 100 });
    if ("calculateRisk" in result) rows.set("event-a", result.claim);
    return result;
  }
  const [first, second] = await Promise.all([attempt("worker-a", now), attempt("worker-b", now)]);
  assert.equal(first.kind, "ACQUIRED");
  assert.equal(second.kind, "BUSY");
  assert.equal(inspectClaimState(first.claim, now + 100), "EXPIRED");
  const recovered = await attempt("worker-b", now + 100);
  assert.equal(recovered.kind, "RECOVERED");
  assert.equal(recovered.claim.token.ownerEpoch, 2);
  assert.equal(recovered.calculateRisk, true); // crash before persistence
  assert.throws(() => riskPersisted(recovered.claim, tokenA, now + 101), /FENCED_OR_EXPIRED/);
  assert.throws(() => acquireClaim({ existing: recovered.claim, scope: scopeA,
    engineVersion: "do-risk-v1", ownerNonce: "worker-b", now: now + 200, leaseMs: 100 }), /NONCE_REUSED/);
  assert.throws(() => acquireClaim({ existing: { ...recovered.claim, leaseExpiresAt: Number.NaN }, scope: scopeA,
    engineVersion: "do-risk-v1", ownerNonce: "worker-c", now: now + 200, leaseMs: 100 }), /CLAIM_CORRUPT/);
});

test("risk checkpoint survives takeover; effects resume without recomputation or event loss", () => {
  const original = riskPersisted();
  assert.equal(inspectClaimState(original, now + 100), "EXPIRED");
  const takeover = acquireClaim({ existing: original, scope: scopeA, engineVersion: "do-risk-v1",
    ownerNonce: "worker-b", now: now + 100, leaseMs: 100 });
  assert.equal(takeover.kind, "RECOVERED");
  assert.equal(takeover.calculateRisk, false);
  const tokenB = takeover.claim.token;
  assert.throws(() => persistRiskCheckpoint(takeover.claim, tokenA,
    { evaluationId: "risk-a", inputFingerprint: fingerprint }, now + 101), /FENCED_OR_EXPIRED/);
  const pending = beginEffects(takeover.claim, tokenB, plan(), now + 101);
  assert.throws(() => completeRiskEffects(pending, tokenB, now + 102), /INCOMPLETE/);
  let current = recordEffectReceipt(pending, tokenB,
    receipt("EVENT_INCIDENT_LINK", pending, tokenB), now + 102);
  assert.equal(current.state, "EFFECTS_PENDING"); // simulated crash after one durable effect
  assert.equal(recordEffectReceipt(current, tokenB,
    receipt("EVENT_INCIDENT_LINK", current, tokenB), now + 102), current);
  for (const key of requiredEffectKeys(pending.plan)) {
    if (key === "EVENT_INCIDENT_LINK") continue;
    current = recordEffectReceipt(current, tokenB, receipt(key, current, tokenB), now + 102);
  }
  const completed = completeRiskEffects(current, tokenB, now + 103);
  assert.equal(completed.state, "COMPLETED");
  assert.throws(() => completeRiskEffects({ ...current,
    effects: { ...current.effects, DECISION_INTENT: { ...current.effects.DECISION_INTENT,
      fingerprint: "forged" } } }, tokenB, now + 103), /INCOMPLETE/);
  assert.equal(acquireClaim({ existing: completed, scope: scopeA, engineVersion: "do-risk-v1",
    ownerNonce: "worker-c", now: now + 200, leaseMs: 100 }).kind, "COMPLETED");
  assert.equal(claim({ ...scopeA, eventId: "event-next" }).state, "CLAIMED");
  assert.equal(claim(scopeA, "do-risk-v2").state, "CLAIMED"); // legitimate re-evaluation
  assert.throws(() => acquireClaim({ existing: completed,
    scope: { ...scopeA, tenantId: "tenant-c" }, engineVersion: "do-risk-v1",
    ownerNonce: "worker-c", now: now + 200, leaseMs: 100 }), /SCOPE_CONFLICT/);
  assert.throws(() => acquireClaim({ existing: completed,
    scope: { ...scopeA, siteId: "site-b" }, engineVersion: "do-risk-v1",
    ownerNonce: "worker-c", now: now + 200, leaseMs: 100 }), /SCOPE_CONFLICT/);
});

test("snapshot, audit and Guard eligibility are explicit; no external dispatch", () => {
  const missingSnapshot = plan();
  missingSnapshot.recipients = { ...missingSnapshot.recipients, digest: "" };
  assert.throws(() => beginEffects(riskPersisted(), tokenA, missingSnapshot, now + 2), /PLAN_INVALID/);
  const pending = beginEffects(riskPersisted(), tokenA, plan(["owner-1"], true), now + 2);
  assert.throws(() => beginEffects(pending, tokenA, plan(["owner-2"], true), now + 3), /PLAN_CHANGED/);
  const changedSettings = plan(["owner-1"], true);
  changedSettings.recipients = freezeRecipientSnapshot("settings-v2", ["owner-1"]);
  assert.throws(() => beginEffects(pending, tokenA, changedSettings, now + 3), /PLAN_CHANGED/);
  assert.throws(() => recordEffectReceipt(pending, tokenA, { ...receipt("RECIPIENT_PLAN", pending),
    recipientSnapshotDigest: "wrong" }, now + 3), /SNAPSHOT_CONFLICT/);
  assert.throws(() => recordEffectReceipt(pending, tokenA, { ...receipt("DECISION_INTENT", pending),
    fingerprint: "different" }, now + 3), /EFFECT_REJECTED/);
  assert.throws(() => recordEffectReceipt(pending, tokenA, { ...receipt("DECISION_INTENT", pending),
    tenantId: "tenant-c" }, now + 3), /EFFECT_REJECTED/);
  let current = pending;
  for (const key of requiredEffectKeys(pending.plan).filter(key => key !== "MEDIA_FAULT_AUDIT")) {
    current = recordEffectReceipt(current, tokenA, receipt(key, current), now + 3);
  }
  assert.equal(current.effects.GUARD_ELIGIBILITY !== undefined, true);
  assert.throws(() => completeRiskEffects(current, tokenA, now + 4), /INCOMPLETE/);
  const recovered = acquireClaim({ existing: pending, scope: scopeA, engineVersion: "do-risk-v1",
    ownerNonce: "worker-b", now: now + 100, leaseMs: 100 });
  assert.equal(recovered.kind, "RECOVERED");
  assert.throws(() => recordEffectReceipt(recovered.claim, tokenA,
    receipt("EVENT_INCIDENT_LINK", recovered.claim), now + 101), /FENCED_OR_EXPIRED/);
  assert.equal(eventRiskAdapterEnabled, false);
  assert.throws(unavailableDurableRiskStore, /ADAPTER_DISABLED/);
});

test("intent duplicate needs semantic equivalence; projections require current fence", () => {
  const expected = { tenantId: "tenant-a", siteId: "site-a", eventId: "event-a",
    incidentId: "incident-a", riskEvaluationId: "risk-a",
    verificationId: "verification-a", decision: "NOTIFY_IN_APP", intentType: "IN_APP_DECISION",
    payloadVersion: "v1", dedupeKey: "decision-a", idempotencyKey: "decision-a",
    recipientSettingsVersion: "settings-v1", recipientSnapshotDigest: fingerprint,
    requiredEvidenceReferences: ["signal:event-a", "risk:risk-a"],
    cooldownUntil: "2026-10-25T00:05:00.000Z", requiresHumanReview: true,
    externalExecutionEnabled: false, verificationVersion: "do-verification-v2",
    finalDecisionVersion: "do-final-decision-v1", finalDecisionConfidence: 0.9,
    decisionStage: "post_verification_final", privacyPolicyAuthoritative: true };
  assert.doesNotThrow(() => assertEquivalentDecisionIntent(expected, { ...expected }));
  assert.throws(() => assertEquivalentDecisionIntent(expected,
    { ...expected, recipientSnapshotDigest: undefined }), /INTENT_INVALID/);
  assert.throws(() => assertEquivalentDecisionIntent(expected,
    { ...expected, requiredEvidenceReferences: ["risk:risk-a", "risk:risk-a"] }), /INTENT_INVALID/);
  assert.throws(() => assertEquivalentDecisionIntent(expected, { ...expected, verificationId: "other" }), /INTENT_CONFLICT/);
  assert.throws(() => assertEquivalentDecisionIntent(expected, { ...expected, decision: "IGNORE" }), /INTENT_CONFLICT/);
  assert.doesNotThrow(() => assertEquivalentDecisionIntent(expected,
    { ...expected, requiredEvidenceReferences: [...expected.requiredEvidenceReferences].reverse() }));
  for (const changed of [
    { tenantId: "tenant-c" }, { eventId: "event-b" }, { recipientSnapshotDigest: "b".repeat(64) },
    { recipientSettingsVersion: "settings-v2" }, { payloadVersion: "v2" },
    { idempotencyKey: "other" }, { requiredEvidenceReferences: ["signal:event-a"] }
  ]) {
    assert.throws(() => assertEquivalentDecisionIntent(expected, { ...expected, ...changed }), /INTENT_CONFLICT/);
  }
  const value = riskPersisted();
  assert.throws(() => persistRiskCheckpoint(value, tokenA,
    { evaluationId: "other-risk", inputFingerprint: fingerprint }, now + 3), /RESULT_INVALID|RESULT_CONFLICT/);
  const projection = { expectedGeneration: 1, persistedGeneration: 1,
    expectedPreviousRiskEvaluationId: null, persistedLatestRiskEvaluationId: null };
  assert.doesNotThrow(() => assertFencedProjectionWrite(value, tokenA, projection, now + 2));
  assert.throws(() => assertFencedProjectionWrite(value, tokenA,
    { ...projection, persistedGeneration: 2 }, now + 2), /PROJECTION_STALE/);
  assert.throws(() => assertFencedProjectionWrite(value, tokenA,
    { ...projection, persistedLatestRiskEvaluationId: "newer-risk" }, now + 2), /PROJECTION_STALE/);
  const takeover = acquireClaim({ existing: value, scope: scopeA, engineVersion: "do-risk-v1",
    ownerNonce: "worker-b", now: now + 100, leaseMs: 100 });
  assert.throws(() => assertFencedProjectionWrite(takeover.claim, tokenA, projection, now + 101), /FENCED_OR_EXPIRED/);
  const renewed = renewClaim(takeover.claim, takeover.claim.token, now + 101, 100);
  const revoked = revokeClaim(renewed, renewed.token, now + 102);
  assert.equal(inspectClaimState(revoked, now + 103), "REVOKED");
  assert.throws(() => acquireClaim({ existing: revoked, scope: scopeA, engineVersion: "do-risk-v1",
    ownerNonce: "worker-c", now: now + 200, leaseMs: 100 }), /CLAIM_REVOKED/);
});
