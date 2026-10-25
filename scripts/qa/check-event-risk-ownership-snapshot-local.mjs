import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Native Node strips TypeScript but does not remap .js source imports to .ts.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(/\/(event-risk-recovery|event-risk-fenced-writes|model-a-ownership)\.js$/.test(specifier)
    ? specifier.replace(/\.js$/, ".ts") : specifier, context);
} });
const { validatePrePersistEventOwnership, bindPostReadRiskOwnership,
  validateAuthoritativeEventRiskOwnership, createDecisionTimeRecipientSnapshot,
  assertDecisionTimeSnapshot, preserveDecisionTimeSnapshot, qualifyAtomicCompletionPlan } =
  await import("../../lib/domain/digital-observer/event-risk-ownership-snapshot.ts");
const { acquireClaim, freezeRecipientSnapshot, requiredEffectKeys } =
  await import("../../lib/domain/digital-observer/event-risk-recovery.ts");
const { persistFencedRisk, startFencedEffects, recordFencedEffect } =
  await import("../../lib/domain/digital-observer/event-risk-fenced-writes.ts");

const now = 1_000_000;
const engineVersion = "do-risk-v1";
const scope = Object.freeze({ tenantId: "tenant-a", siteId: "site-a", sourceId: "source-a",
  eventId: "event-a", incidentId: "incident-a", riskDecisionId: "risk-a" });
const principal = { tenantId: "tenant-a", siteId: "site-a", lifecycleState: "ACTIVE" };
function reader({ ambiguous = false, missingAuthority = false, tenantOverride = null } = {}) {
  const sites = {
    "site-a": { siteId: "site-a", tenantId: tenantOverride ?? "tenant-a", siteType: "home", gardenId: null },
    "site-b": { siteId: "site-b", tenantId: "tenant-a", siteType: "business", gardenId: null },
    "site-c": { siteId: "site-c", tenantId: "tenant-c", siteType: "home", gardenId: null }
  };
  const suffixes = ["a", "b", "c"];
  const rows = kind => Object.fromEntries(suffixes.map(suffix => {
    const id = `${kind}-${suffix}`;
    if (kind === "source") return [id, { id, siteId: `site-${suffix}`, externalSourceId: "CH1" }];
    if (kind === "event") return [id, { id, siteId: `site-${suffix}`,
      sourceId: `source-${suffix}`, incidentId: `incident-${suffix}` }];
    if (kind === "incident") return [id, { id, siteId: `site-${suffix}`, eventIds: [`event-${suffix}`] }];
    return [id, { id, siteId: `site-${suffix}`, eventId: `event-${suffix}`,
      incidentId: `incident-${suffix}`, riskEngineVersion: "do-risk-v1" }];
  }));
  return {
    async site(id) { return sites[id] ?? null; },
    async source(id) { return rows("source")[id] ?? null; },
    async event(id) { return rows("event")[id] ?? null; },
    async incident(id) { return rows("incident")[id] ?? null; },
    async riskDecision(id) { return rows("risk")[id] ?? null; },
    async authoritativeTenantForEvent(siteId, eventId) {
      if (missingAuthority) return null;
      return { tenantId: siteId === "site-c" ? "tenant-c" : "tenant-a", siteId, eventId,
        evidenceRef: `owner-adjudication:${siteId}:${eventId}`,
        verifiedForEvent: !ambiguous, historicallyAmbiguous: ambiguous };
    }
  };
}
function ownershipInput(overrides = {}) {
  return { reader: reader(), principal, sourceId: scope.sourceId, eventId: scope.eventId,
    incidentId: scope.incidentId, riskDecisionId: scope.riskDecisionId,
    expectedRiskEngineVersion: engineVersion, ...overrides };
}
function preInput(overrides = {}) {
  const { riskDecisionId: ignoredRisk, expectedRiskEngineVersion: ignoredVersion, ...input } = ownershipInput(overrides);
  void ignoredRisk;
  void ignoredVersion;
  return input;
}
function snapshot(overrides = {}) {
  return createDecisionTimeRecipientSnapshot({ schemaVersion: 1, scope,
    decisionCode: "REVIEW", severity: "high", settingsVersion: "settings-v1",
    policyVersion: "policy-v1", capturedAt: "2026-10-25T12:00:00.000Z",
    recipients: [{ recipientRef: "owner-a", channels: [{ channel: "in_app", enabled: true,
      severityLevels: ["high", "critical"] }] }], ...overrides });
}
const recipients = freezeRecipientSnapshot("settings-v1", ["owner-a"]);
const basePlan = { watchRuleIds: [], recipients, mediaFaultAuditRequired: false };
const plan = { ...basePlan, expectedFingerprints:
  Object.fromEntries(requiredEffectKeys(basePlan).map(key => [key, `fp:${key}`])) };
function intent() {
  return { tenantId: scope.tenantId, siteId: scope.siteId, eventId: scope.eventId,
    incidentId: scope.incidentId, riskEvaluationId: "risk-a", verificationId: "verification-a",
    decision: "REVIEW", intentType: "risk-review", payloadVersion: "1", dedupeKey: "intent-a",
    idempotencyKey: "intent-a", cooldownUntil: "2030-01-01T00:00:00Z",
    recipientSettingsVersion: recipients.settingsVersion, recipientSnapshotDigest: recipients.digest,
    requiredEvidenceReferences: ["evidence-a"], requiresHumanReview: true,
    externalExecutionEnabled: false, verificationVersion: "v1", finalDecisionVersion: "v1",
    finalDecisionConfidence: 0.7, decisionStage: "post_verification_final",
    privacyPolicyAuthoritative: true };
}
function context(state, overrides = {}) {
  return { scope, engineVersion, token: state.claim.token, now: now + 1,
    expectedWriteGeneration: state.writeGeneration, ...overrides };
}
function preparedState() {
  const acquired = acquireClaim({ existing: null, scope, engineVersion,
    ownerNonce: "owner-a", now, leaseMs: 100 });
  let state = { claim: acquired.claim, writeGeneration: 0, riskResult: null, effects: {},
    riskProjection: { generation: 0, latestReferenceId: null },
    verificationProjection: { generation: 0, latestReferenceId: null }, guardDispatchCount: 0 };
  state = persistFencedRisk(state, context(state), { checkpoint:
    { evaluationId: "risk-a", inputFingerprint: "a".repeat(64) },
    scope, engineVersion, semanticFingerprint: "b".repeat(64) });
  return startFencedEffects(state, context(state), plan);
}
function record(state, key) {
  const recipientSnapshotDigest = key === "RECIPIENT_PLAN" || key.startsWith("IN_APP_JOURNAL:")
    ? recipients.digest : undefined;
  const rowId = key === "RISK_DECISION" || key === "INCIDENT_RISK_PROJECTION" ? "risk-a"
    : key === "INCIDENT_VERIFICATION_PROJECTION" ? "verification-a" : `row:${key}`;
  const receipt = { key, tenantId: scope.tenantId, siteId: scope.siteId, eventId: scope.eventId,
    ownerEpoch: state.claim.token.ownerEpoch, riskEvaluationId: "risk-a",
    fingerprint: plan.expectedFingerprints[key], ...(recipientSnapshotDigest ? { recipientSnapshotDigest } : {}) };
  const evidence = { key, rowId, scope, riskEvaluationId: "risk-a", fingerprint: receipt.fingerprint,
    ...(recipientSnapshotDigest ? { recipientSnapshotDigest } : {}),
    ...(key === "DECISION_INTENT" ? { decisionIntent: intent() } : {}),
    ...(key === "MANDATORY_DECISION_AUDIT" ? { auditCommitted: true } : {}) };
  const projection = key === "INCIDENT_RISK_PROJECTION" ? state.riskProjection
    : key === "INCIDENT_VERIFICATION_PROJECTION" ? state.verificationProjection : undefined;
  return recordFencedEffect(state, context(state), receipt, evidence, projection);
}
function completeState() {
  let state = preparedState();
  for (const key of requiredEffectKeys(plan)) state = record(state, key);
  return state;
}
function qualification(state = completeState(), overrides = {}) {
  const fixedSnapshot = snapshot();
  return { state, context: context(state), ownership: { stage: "POST_READ_RISK_SCOPE_BOUND",
    scope, riskEngineVersion: engineVersion, authorityEvidenceRef: "owner-adjudication-a" },
    persistedSnapshot: fixedSnapshot, expectedSnapshot: fixedSnapshot,
    expectedRiskProjectionGeneration: 1, expectedVerificationProjectionGeneration: 1,
    expectedDecisionIntent: intent(), externalAcknowledgmentRequired: true, ...overrides };
}

test("authoritative Model A chain permits two Sites in one Tenant and rejects unverified ownership", async () => {
  const first = await validateAuthoritativeEventRiskOwnership(ownershipInput());
  const second = await validateAuthoritativeEventRiskOwnership(ownershipInput({
    principal: { ...principal, siteId: "site-b" }, sourceId: "source-b", eventId: "event-b",
    incidentId: "incident-b", riskDecisionId: "risk-b" }));
  assert.equal(first.scope.tenantId, second.scope.tenantId);
  assert.notEqual(first.scope.siteId, second.scope.siteId);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ reader: reader({ ambiguous: true }) })), /UNVERIFIED/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ reader: reader({ missingAuthority: true }) })), /UNVERIFIED/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ reader: reader({ tenantOverride: "" }) })), /UNVERIFIED/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ reader: reader({ tenantOverride: "tenant-c" }) })), /UNVERIFIED|MISMATCH/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ sourceId: "source-c" })), /MISMATCH/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ eventId: "event-b" })), /UNVERIFIED|MISMATCH/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ incidentId: "incident-b" })), /MISMATCH/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ riskDecisionId: "risk-b" })), /MISMATCH/);
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({ clientTenantId: "tenant-a" })), /OVERRIDE_DENIED/);
});

test("pre-persist Event ownership needs no Risk row and cannot qualify completion", async () => {
  let riskReads = 0;
  const syntheticReader = reader();
  const pre = await validatePrePersistEventOwnership(preInput({ reader: {
    ...syntheticReader, async riskDecision() { riskReads += 1; return null; }
  } }));
  assert.equal(pre.stage, "PRE_PERSIST_EVENT_CHAIN_VALIDATED");
  assert.equal(Object.hasOwn(pre.scope, "riskDecisionId"), false);
  assert.equal(riskReads, 0);
  assert(Object.isFrozen(pre.scope));
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(completeState(), {
    ownership: pre
  })), /MODEL_A_COMPLETION_OWNERSHIP_UNVERIFIED/);
  assert.throws(() => createDecisionTimeRecipientSnapshot({ ...snapshot(), scope: pre.scope }),
    /RECIPIENT_SNAPSHOT_INVALID/);
});

test("pre-persist authority and canonical chain fail closed on scope, ambiguity and overrides", async () => {
  await assert.rejects(validatePrePersistEventOwnership(preInput({ reader: reader({ ambiguous: true }) })), /UNVERIFIED/);
  await assert.rejects(validatePrePersistEventOwnership(preInput({ reader: reader({ missingAuthority: true }) })), /UNVERIFIED/);
  await assert.rejects(validatePrePersistEventOwnership(preInput({ reader: reader({ tenantOverride: "tenant-c" }) })), /UNVERIFIED|MISMATCH/);
  await assert.rejects(validatePrePersistEventOwnership(preInput({ principal: { ...principal,
    lifecycleState: "REVOKED" } })), /PRINCIPAL_SCOPE_UNVERIFIED/);
  let authorityReads = 0;
  await assert.rejects(validatePrePersistEventOwnership(preInput({
    principal: { ...principal, lifecycleState: "REVOKED" }, reader: { ...reader(),
      async authoritativeTenantForEvent() { authorityReads += 1; return null; } }
  })), /PRINCIPAL_SCOPE_UNVERIFIED/);
  assert.equal(authorityReads, 0);
  for (const [key, value] of [["sourceId", "source-c"], ["eventId", "event-b"],
    ["incidentId", "incident-b"]]) {
    await assert.rejects(validatePrePersistEventOwnership(preInput({ [key]: value })), /UNVERIFIED|MISMATCH/);
  }
  await assert.rejects(validatePrePersistEventOwnership(preInput({ clientTenantId: "tenant-a" })), /OVERRIDE_DENIED/);
  await assert.rejects(validatePrePersistEventOwnership(preInput({ clientSiteId: "site-a" })), /OVERRIDE_DENIED/);
});

test("post-read Risk binding verifies row and revalidates event-time evidence", async () => {
  const input = preInput();
  const prePersist = await validatePrePersistEventOwnership(input);
  const bind = (overrides = {}) => ({ ...input, prePersist, riskDecisionId: "risk-a",
    expectedRiskEngineVersion: engineVersion, ...overrides });
  const bound = await bindPostReadRiskOwnership(bind());
  assert.equal(bound.stage, "POST_READ_RISK_SCOPE_BOUND");
  assert.equal(bound.scope.riskDecisionId, "risk-a");
  assert.equal(bound.riskEngineVersion, engineVersion);
  assert.equal(bound.authorityEvidenceRef, prePersist.authorityEvidenceRef);
  await assert.rejects(bindPostReadRiskOwnership(bind({ riskDecisionId: "risk-b" })), /RISK_SCOPE_MISMATCH/);
  await assert.rejects(bindPostReadRiskOwnership(bind({ riskDecisionId: "" })), /PRE_PERSIST_OR_RISK_MISSING/);
  await assert.rejects(bindPostReadRiskOwnership(bind({ prePersist: { ...prePersist,
    scope: { ...prePersist.scope, eventId: "event-b" } } })), /CHAIN_CHANGED/);
  await assert.rejects(bindPostReadRiskOwnership(bind({ prePersist: { ...prePersist,
    authorityEvidenceRef: "different-evidence" } })), /CHAIN_CHANGED/);
  await assert.rejects(bindPostReadRiskOwnership(bind({ reader: {
    ...input.reader, async authoritativeTenantForEvent(siteId, eventId) {
      const old = await input.reader.authoritativeTenantForEvent(siteId, eventId);
      return { ...old, evidenceRef: "new-adjudication" };
    }
  } })), /CHAIN_CHANGED/);
  await assert.rejects(bindPostReadRiskOwnership(bind({ reader: {
    ...input.reader, async riskDecision() { return { id: "risk-a", siteId: "site-c",
      eventId: "event-a", incidentId: "incident-a", riskEngineVersion: engineVersion }; }
  } })), /RISK_SCOPE_MISMATCH/);
  for (const wrong of [{ eventId: "event-b" }, { incidentId: "incident-b" }]) {
    await assert.rejects(bindPostReadRiskOwnership(bind({ reader: {
      ...input.reader, async riskDecision() { return { id: "risk-a", siteId: "site-a",
        eventId: "event-a", incidentId: "incident-a", riskEngineVersion: engineVersion, ...wrong }; }
    } })), /RISK_SCOPE_MISMATCH/);
  }
  await assert.rejects(bindPostReadRiskOwnership(bind({ sourceId: "source-b" })), /OWNERSHIP_CHAIN_MISMATCH/);
});

test("Risk engine version is mandatory, exact and bound to the post-read result", async () => {
  const input = preInput();
  const prePersist = await validatePrePersistEventOwnership(input);
  const bind = (overrides = {}) => ({ ...input, prePersist, riskDecisionId: "risk-a",
    expectedRiskEngineVersion: engineVersion, ...overrides });
  for (const invalid of [undefined, "", " "]) {
    await assert.rejects(bindPostReadRiskOwnership(bind({ expectedRiskEngineVersion: invalid })),
      /RISK_ENGINE_VERSION_REQUIRED/);
  }
  await assert.rejects(validateAuthoritativeEventRiskOwnership(ownershipInput({
    expectedRiskEngineVersion: undefined
  })), /RISK_ENGINE_VERSION_REQUIRED/);
  await assert.rejects(bindPostReadRiskOwnership(bind({ expectedRiskEngineVersion: "do-risk-v2" })),
    /RISK_ENGINE_VERSION_MISMATCH/);
  for (const wrong of [undefined, "", "do-risk-v2"]) {
    await assert.rejects(bindPostReadRiskOwnership(bind({ reader: { ...input.reader,
      async riskDecision() { return { id: "risk-a", siteId: "site-a", eventId: "event-a",
        incidentId: "incident-a", riskEngineVersion: wrong }; }
    } })), /RISK_ENGINE_VERSION_MISMATCH/);
  }
  const v2Reader = { ...input.reader, async riskDecision(id) {
    return id === "risk-v2" ? { id, siteId: "site-a", eventId: "event-a",
      incidentId: "incident-a", riskEngineVersion: "do-risk-v2" } : null;
  } };
  const v2 = await bindPostReadRiskOwnership(bind({ reader: v2Reader,
    riskDecisionId: "risk-v2", expectedRiskEngineVersion: "do-risk-v2" }));
  assert.equal(v2.riskEngineVersion, "do-risk-v2");
  assert.notEqual(v2.riskEngineVersion, engineVersion);
  assert.equal(v2.scope.eventId, prePersist.scope.eventId);
  await assert.rejects(bindPostReadRiskOwnership(bind({ reader: v2Reader,
    riskDecisionId: "risk-v2" })), /RISK_ENGINE_VERSION_MISMATCH/);
});

test("decision-time recipient snapshot is canonical, immutable and cannot be replaced on retry", () => {
  const original = snapshot();
  assertDecisionTimeSnapshot(original);
  assert(Object.isFrozen(original.recipients[0].channels[0].severityLevels));
  assert.throws(() => { original.recipients[0].channels[0].enabled = false; }, TypeError);
  const reordered = snapshot({ recipients: [{ recipientRef: "owner-a", channels: [{ channel: "in_app", enabled: true,
    severityLevels: ["critical", "high"] }] }] });
  assert.equal(original.fingerprint, reordered.fingerprint);
  assert.equal(preserveDecisionTimeSnapshot(original, reordered), original);
  assert.throws(() => preserveDecisionTimeSnapshot(original,
    snapshot({ settingsVersion: "settings-v2" })), /REPLACEMENT_DENIED/);
  assert.throws(() => assertDecisionTimeSnapshot({ ...original, policyVersion: "changed" }), /FINGERPRINT_MISMATCH/);
  assert.throws(() => preserveDecisionTimeSnapshot(original,
    snapshot({ scope: { ...scope, tenantId: "tenant-c" } })), /REPLACEMENT_DENIED/);
  assert.throws(() => createDecisionTimeRecipientSnapshot({ ...original, recipients:
    [original.recipients[0], original.recipients[0]] }), /SNAPSHOT_INVALID/);
});

test("completion requires risk, fence, every mandatory effect, projections, audit and semantic intent", () => {
  const state = completeState();
  const passed = qualifyAtomicCompletionPlan(qualification(state));
  assert.equal(passed.riskPersisted, true);
  assert.equal(passed.mandatoryEffectsCompleted, true);
  assert.equal(passed.externalActionAcknowledged, false);
  assert.equal(passed.fullCompletion, false);
  assert.equal(state.guardDispatchCount, 0);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification({ ...state, riskResult: null })), /MISSING/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { context:
    context(state, { token: { ownerNonce: "old-owner", ownerEpoch: 0 } }) })), /FENCED/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification({ ...state, effects:
    Object.fromEntries(Object.entries(state.effects).filter(([key]) => key !== "IN_APP_JOURNAL:owner-a")) })), /INCOMPLETE/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { expectedRiskProjectionGeneration: 2 })), /PROJECTION_STALE/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { expectedVerificationProjectionGeneration: 2 })), /PROJECTION_STALE/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification({ ...state, effects:
    { ...state.effects, MANDATORY_DECISION_AUDIT: { ...state.effects.MANDATORY_DECISION_AUDIT, auditCommitted: undefined } } })), /AUDIT_MISSING/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { expectedDecisionIntent:
    { ...intent(), decision: "ALLOW" } })), /CONFLICT/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { expectedSnapshot:
    snapshot({ settingsVersion: "settings-v2" }) })), /REPLACEMENT_DENIED/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { persistedSnapshot:
    snapshot({ scope: { ...scope, tenantId: "tenant-c" } }), expectedSnapshot:
      snapshot({ scope: { ...scope, tenantId: "tenant-c" } }) })), /SNAPSHOT_SCOPE_CONFLICT/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { ownership:
    { scope: { ...scope, tenantId: "tenant-c" }, authorityEvidenceRef: "wrong" } })), /UNVERIFIED/);
  assert.throws(() => qualifyAtomicCompletionPlan(qualification(state, { ownership:
    { ...qualification(state).ownership, riskEngineVersion: "do-risk-v2" } })), /UNVERIFIED/);
});

test("mandatory local completion and external delivery/Guard acknowledgment remain separate", () => {
  const state = completeState();
  const local = qualifyAtomicCompletionPlan(qualification(state, { externalAcknowledgmentRequired: false }));
  assert.equal(local.fullCompletion, true);
  assert.equal(local.externalActionAcknowledged, false);
  assert.equal(state.effects.GUARD_ELIGIBILITY.rowId, "row:GUARD_ELIGIBILITY");
  assert.equal(state.guardDispatchCount, 0);
});
