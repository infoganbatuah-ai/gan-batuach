import { createHash } from "node:crypto";
import { assertEquivalentDecisionIntent, freezeRecipientSnapshot,
  type CanonicalDecisionIntent } from "./event-risk-recovery.js";
import { assertFencedWrite, completeFencedRisk,
  type FencedWriteContext, type FencedWriteState } from "./event-risk-fenced-writes.js";
import { resolveModelAChain, type ModelAOwnershipReader,
  type ResolvedModelAChain } from "./model-a-ownership.js";
import type { ManagedDevicePrincipal } from "./managed-device-identity";

// No deployed adapter implements this trusted read. In particular, a nullable
// organization ID or client-supplied Tenant is not an ownership attestation.
export type EventTimeTenantEvidence = Readonly<{
  tenantId: string;
  siteId: string;
  eventId: string;
  evidenceRef: string;
  verifiedForEvent: true;
  historicallyAmbiguous: false;
}>;
export interface AuthoritativeEventOwnershipReader extends ModelAOwnershipReader {
  authoritativeTenantForEvent(siteId: string, eventId: string): Promise<EventTimeTenantEvidence | null>;
}
export type PrePersistEventOwnership = Readonly<{
  stage: "PRE_PERSIST_EVENT_CHAIN_VALIDATED";
  scope: Readonly<Omit<ResolvedModelAChain, "riskDecisionId">>;
  authorityEvidenceRef: string;
}>;
export type PostReadRiskScopeBoundOwnership = Readonly<{
  stage: "POST_READ_RISK_SCOPE_BOUND";
  scope: Readonly<ResolvedModelAChain & { riskDecisionId: string }>;
  authorityEvidenceRef: string;
}>;
export type VerifiedEventRiskOwnership = PostReadRiskScopeBoundOwnership;

type EventOwnershipInput = Readonly<{
  reader: AuthoritativeEventOwnershipReader;
  principal: Pick<ManagedDevicePrincipal, "tenantId" | "siteId" | "lifecycleState">;
  sourceId: string;
  eventId: string;
  incidentId: string;
  clientTenantId?: string;
  clientSiteId?: string;
}>;

/** Disconnected pre-insert check: no Risk UUID or persisted-row claim. */
export async function validatePrePersistEventOwnership(input: EventOwnershipInput): Promise<PrePersistEventOwnership> {
  if (input.clientTenantId !== undefined || input.clientSiteId !== undefined) {
    throw new Error("MODEL_A_CLIENT_OWNERSHIP_OVERRIDE_DENIED");
  }
  if (input.principal.lifecycleState !== "ACTIVE" || !input.principal.tenantId || !input.principal.siteId) {
    throw new Error("MODEL_A_PRINCIPAL_SCOPE_UNVERIFIED");
  }
  const authority = await input.reader.authoritativeTenantForEvent(input.principal.siteId, input.eventId);
  if (!authority?.verifiedForEvent || authority.historicallyAmbiguous !== false
    || !authority.evidenceRef || authority.siteId !== input.principal.siteId
    || authority.eventId !== input.eventId || authority.tenantId !== input.principal.tenantId) {
    throw new Error("MODEL_A_EVENT_TIME_TENANT_UNVERIFIED");
  }
  const scope = await resolveModelAChain({ reader: input.reader, principal: input.principal,
    sourceId: input.sourceId, eventId: input.eventId, incidentId: input.incidentId });
  if (scope.tenantId !== authority.tenantId || scope.siteId !== authority.siteId
    || scope.eventId !== authority.eventId || scope.riskDecisionId !== null) {
    throw new Error("MODEL_A_EVENT_TIME_CHAIN_CONFLICT");
  }
  return Object.freeze({ stage: "PRE_PERSIST_EVENT_CHAIN_VALIDATED" as const,
    scope: Object.freeze({ tenantId: scope.tenantId, siteId: scope.siteId,
      sourceId: scope.sourceId, eventId: scope.eventId, incidentId: scope.incidentId }),
    authorityEvidenceRef: authority.evidenceRef });
}

/** The Risk ID is a lookup key only; the trusted reader must verify its row. */
export async function bindPostReadRiskOwnership(input: EventOwnershipInput & {
  prePersist: PrePersistEventOwnership;
  riskDecisionId: string;
}): Promise<PostReadRiskScopeBoundOwnership> {
  if (input.prePersist?.stage !== "PRE_PERSIST_EVENT_CHAIN_VALIDATED" || !input.riskDecisionId) {
    throw new Error("MODEL_A_PRE_PERSIST_OR_RISK_MISSING");
  }
  // Re-read authority and every canonical link. A caller-supplied pre result
  // or Risk UUID cannot certify ownership, and changed evidence fails closed.
  const current = await validatePrePersistEventOwnership(input);
  if (!input.prePersist.authorityEvidenceRef
    || input.prePersist.authorityEvidenceRef !== current.authorityEvidenceRef
    || !samePrePersistScope(input.prePersist.scope, current.scope)) {
    throw new Error("MODEL_A_PRE_PERSIST_CHAIN_CHANGED");
  }
  const scope = await resolveModelAChain({ ...input, riskDecisionId: input.riskDecisionId });
  if (scope.riskDecisionId !== input.riskDecisionId || !samePrePersistScope(scope, current.scope)) {
    throw new Error("MODEL_A_RISK_SCOPE_MISMATCH");
  }
  return Object.freeze({ stage: "POST_READ_RISK_SCOPE_BOUND" as const,
    scope: Object.freeze({ ...scope, riskDecisionId: input.riskDecisionId }),
    authorityEvidenceRef: current.authorityEvidenceRef });
}

function samePrePersistScope(left: PrePersistEventOwnership["scope"], right: PrePersistEventOwnership["scope"]): boolean {
  return left.tenantId === right.tenantId && left.siteId === right.siteId
    && left.sourceId === right.sourceId && left.eventId === right.eventId
    && left.incidentId === right.incidentId;
}

/** Strict compatibility wrapper for disconnected post-persist callers. */
export async function validateAuthoritativeEventRiskOwnership(input: EventOwnershipInput & {
  riskDecisionId: string;
}): Promise<VerifiedEventRiskOwnership> {
  const prePersist = await validatePrePersistEventOwnership(input);
  return bindPostReadRiskOwnership({ ...input, prePersist });
}

export type SnapshotChannel = "in_app" | "email" | "sms" | "push";
export type SnapshotRecipient = Readonly<{
  recipientRef: string;
  channels: readonly Readonly<{
    channel: SnapshotChannel;
    enabled: boolean;
    severityLevels: readonly string[];
  }>[];
}>;
export type DecisionTimeRecipientSnapshot = Readonly<{
  schemaVersion: 1;
  scope: ResolvedModelAChain;
  decisionCode: string;
  severity: string;
  settingsVersion: string;
  policyVersion: string;
  capturedAt: string;
  recipients: readonly SnapshotRecipient[];
  fingerprint: string;
}>;

function canonicalSnapshotContent(input: Omit<DecisionTimeRecipientSnapshot, "fingerprint">) {
  if (input.schemaVersion !== 1 || !input.scope.tenantId || !input.scope.siteId
    || !input.scope.eventId || !input.scope.incidentId || !input.scope.riskDecisionId
    || !input.decisionCode || !input.severity || !input.settingsVersion || !input.policyVersion
    || input.decisionCode.length > 64 || input.severity.length > 32
    || input.settingsVersion.length > 128 || input.policyVersion.length > 128
    || !Number.isFinite(Date.parse(input.capturedAt))
    || input.recipients.length > 100) throw new Error("RECIPIENT_SNAPSHOT_INVALID");
  const refs = new Set<string>();
  const recipients = input.recipients.map(recipient => {
    if (!recipient.recipientRef || recipient.recipientRef.length > 128 || refs.has(recipient.recipientRef)
      || recipient.channels.length > 4) throw new Error("RECIPIENT_SNAPSHOT_INVALID");
    refs.add(recipient.recipientRef);
    const channels = new Set<SnapshotChannel>();
    return Object.freeze({ recipientRef: recipient.recipientRef,
      channels: Object.freeze(recipient.channels.map(setting => {
        if (!["in_app", "email", "sms", "push"].includes(setting.channel)
          || channels.has(setting.channel) || typeof setting.enabled !== "boolean"
          || setting.severityLevels.length > 16
          || setting.severityLevels.some(level => !level || level.length > 32)
          || new Set(setting.severityLevels).size !== setting.severityLevels.length) {
          throw new Error("RECIPIENT_SNAPSHOT_INVALID");
        }
        channels.add(setting.channel);
        return Object.freeze({ channel: setting.channel, enabled: setting.enabled,
          severityLevels: Object.freeze([...setting.severityLevels].sort()) });
      }).sort((a, b) => a.channel.localeCompare(b.channel))) });
  }).sort((a, b) => a.recipientRef.localeCompare(b.recipientRef));
  return Object.freeze({ schemaVersion: 1 as const,
    scope: Object.freeze({ ...input.scope }), decisionCode: input.decisionCode,
    severity: input.severity, settingsVersion: input.settingsVersion,
    policyVersion: input.policyVersion, capturedAt: new Date(input.capturedAt).toISOString(),
    recipients: Object.freeze(recipients) });
}

function fingerprint(content: ReturnType<typeof canonicalSnapshotContent>): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export function createDecisionTimeRecipientSnapshot(
  input: Omit<DecisionTimeRecipientSnapshot, "fingerprint">): DecisionTimeRecipientSnapshot {
  const content = canonicalSnapshotContent(input);
  return Object.freeze({ ...content, fingerprint: fingerprint(content) });
}

export function assertDecisionTimeSnapshot(snapshot: DecisionTimeRecipientSnapshot): void {
  const content = canonicalSnapshotContent(snapshot);
  if (fingerprint(content) !== snapshot.fingerprint) throw new Error("RECIPIENT_SNAPSHOT_FINGERPRINT_MISMATCH");
}

export function preserveDecisionTimeSnapshot(existing: DecisionTimeRecipientSnapshot,
  proposed: DecisionTimeRecipientSnapshot): DecisionTimeRecipientSnapshot {
  assertDecisionTimeSnapshot(existing);
  assertDecisionTimeSnapshot(proposed);
  if (existing.fingerprint !== proposed.fingerprint) throw new Error("RECIPIENT_SNAPSHOT_REPLACEMENT_DENIED");
  return existing;
}

function sameScope(left: ResolvedModelAChain, right: ResolvedModelAChain): boolean {
  return left.tenantId === right.tenantId && left.siteId === right.siteId
    && left.sourceId === right.sourceId && left.eventId === right.eventId
    && left.incidentId === right.incidentId && left.riskDecisionId === right.riskDecisionId;
}

export type LocalCompletionQualification = Readonly<{
  riskPersisted: true;
  mandatoryEffectsCompleted: true;
  externalActionAcknowledged: false;
  fullCompletion: boolean;
  // This is local contract qualification, not a database commit or delivery.
  claimState: "COMPLETED";
}>;

export function qualifyAtomicCompletionPlan(input: {
  state: FencedWriteState;
  context: FencedWriteContext;
  ownership: VerifiedEventRiskOwnership;
  persistedSnapshot: DecisionTimeRecipientSnapshot;
  expectedSnapshot: DecisionTimeRecipientSnapshot;
  expectedRiskProjectionGeneration: number;
  expectedVerificationProjectionGeneration: number;
  expectedDecisionIntent: CanonicalDecisionIntent;
  externalAcknowledgmentRequired: boolean;
}): LocalCompletionQualification {
  const { state, context, ownership } = input;
  assertFencedWrite(state, context);
  if (ownership.stage !== "POST_READ_RISK_SCOPE_BOUND"
    || !sameScope(ownership.scope, context.scope)
    || !ownership.authorityEvidenceRef) throw new Error("MODEL_A_COMPLETION_OWNERSHIP_UNVERIFIED");
  if (!state.riskResult || !state.claim.risk || !state.claim.plan
    || state.riskResult.checkpoint.evaluationId !== state.claim.risk.evaluationId) {
    throw new Error("RISK_COMPLETION_RESULT_OR_PLAN_MISSING");
  }
  const snapshot = preserveDecisionTimeSnapshot(input.persistedSnapshot, input.expectedSnapshot);
  if (!sameScope(snapshot.scope, context.scope)
    || snapshot.scope.riskDecisionId !== state.claim.risk.evaluationId
    || snapshot.decisionCode !== input.expectedDecisionIntent.decision
    || snapshot.settingsVersion !== state.claim.plan.recipients.settingsVersion
    || freezeRecipientSnapshot(snapshot.settingsVersion,
      snapshot.recipients.filter(recipient => recipient.channels.some(channel => channel.channel === "in_app"
        && channel.enabled && (!channel.severityLevels.length || channel.severityLevels.includes(snapshot.severity))))
        .map(recipient => recipient.recipientRef)).digest !== state.claim.plan.recipients.digest) {
    throw new Error("RISK_COMPLETION_SNAPSHOT_SCOPE_CONFLICT");
  }
  if (!Number.isSafeInteger(input.expectedRiskProjectionGeneration)
    || !Number.isSafeInteger(input.expectedVerificationProjectionGeneration)
    || input.expectedRiskProjectionGeneration < 1 || input.expectedVerificationProjectionGeneration < 1
    || state.riskProjection.generation !== input.expectedRiskProjectionGeneration
    || state.verificationProjection.generation !== input.expectedVerificationProjectionGeneration) {
    throw new Error("RISK_COMPLETION_PROJECTION_STALE");
  }
  const storedIntent = state.effects.DECISION_INTENT?.decisionIntent;
  if (!storedIntent) throw new Error("RISK_COMPLETION_INTENT_MISSING");
  assertEquivalentDecisionIntent(input.expectedDecisionIntent, storedIntent);
  if (!state.effects.MANDATORY_DECISION_AUDIT?.auditCommitted) {
    throw new Error("RISK_COMPLETION_AUDIT_MISSING");
  }
  const completed = completeFencedRisk(state, context);
  if (completed.claim.state !== "COMPLETED" || completed.guardDispatchCount !== 0) {
    throw new Error("RISK_COMPLETION_INVALID");
  }
  return Object.freeze({ riskPersisted: true, mandatoryEffectsCompleted: true,
    externalActionAcknowledged: false, fullCompletion: !input.externalAcknowledgmentRequired,
    claimState: "COMPLETED" as const });
}
