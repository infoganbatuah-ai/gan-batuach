import type { PrivacyContext, RetentionDataClass } from "./privacy-compliance.js";

// Disconnected engineering dry-run. Not the active privacy policy, a cleanup
// executor, a legal approval, or an authority to collect real data.
export const ENGINEERING_RETENTION_POLICY_V1 = Object.freeze({
  version: "do-retention-engineering-v1",
  source: "owner-delegated-policy-v1",
  status: "ENGINEERING_BASELINE" as const,
  externalLegalApproval: false as const,
  realDataActivationReady: false as const,
  jurisdiction: "IL",
  context: "HOME" as PrivacyContext,
  postClosureDays: 30,
  technicalSecurityLogMonths: 24,
  syntheticDebugDays: 7,
  exceptionReviewDays: 30
});

const protectedExistingDataClasses = [
  "DIGITAL_OBSERVER_EVIDENCE", "SOURCE_RECORDING_REFERENCE",
  "INVESTIGATION_CASE", "BIOMETRIC_TEMPLATE"
] as const satisfies readonly RetentionDataClass[];

export const engineeringRetentionCategories = [
  "REGISTRATION_VERSION", "EVENT_ACCEPTANCE_BINDING", "RISK_PROCESSING",
  "RECIPIENT_SETTINGS_REFERENCE", "REGISTRATION_BUSINESS_AUDIT",
  "SECURITY_COMPLIANCE_LOG", "DEBUG_TELEMETRY",
  ...protectedExistingDataClasses, "CHILD_SENSITIVE_DATA"
] as const;
export type EngineeringRetentionCategory = (typeof engineeringRetentionCategories)[number];

export type RetentionDependencyKind = "EVENT" | "INCIDENT" | "CLAIM" | "EFFECT"
  | "EXTERNAL_OUTCOME" | "DELIVERY" | "COMPLAINT" | "INVESTIGATION"
  | "REPLAY" | "RESTORE" | "ROLLBACK";
export type RetentionDependency = Readonly<{
  kind: RetentionDependencyKind;
  state: "ACTIVE" | "RESOLVED" | "UNKNOWN" | "UNBOUNDED";
  resolvedAt?: string | null;
  horizonUntil?: string | null;
}>;

export type EngineeringRetentionInput = Readonly<{
  authority: "TRUSTED_SERVER";
  category: EngineeringRetentionCategory;
  context: PrivacyContext;
  jurisdiction: string | null;
  policyVersion: string | null;
  purpose: string | null;
  environment: "SYNTHETIC_QA" | "REAL";
  securityClassification: "OPERATIONAL_METADATA" | "BUSINESS_AUDIT"
    | "TECHNICAL_SECURITY_LOG" | "NON_SENSITIVE_DEBUG" | "SPECIAL_OR_MEDIA" | null;
  securityLogApplicability: "APPLIES" | "DOES_NOT_APPLY" | "UNKNOWN";
  recordedAt: string;
  closedAt?: string | null;
  registration?: Readonly<{
    currentVersion: boolean;
    sourceActive: boolean;
    supersededAt?: string | null;
    sourceRetiredAt?: string | null;
  }>;
  hold: Readonly<{
    state: "NONE" | "ACTIVE" | "RELEASED" | "UNKNOWN";
    activatedAt?: string | null;
    reviewedAt?: string | null;
    releasedAt?: string | null;
  }>;
  dependencies: readonly RetentionDependency[];
}>;

export type EngineeringRetentionState = "KEEP_REQUIRED" | "WAIT_DEPENDENCIES"
  | "WAIT_POLICY" | "ELIGIBLE_FOR_REVIEW" | "INVALID_INPUT";
export type EngineeringRetentionReason = "INPUT_INVALID" | "TIME_INVALID"
  | "POLICY_VERSION_REVIEW" | "POLICY_SCOPE_UNQUALIFIED"
  | "SECURITY_CLASSIFICATION_REQUIRED" | "CATEGORY_POLICY_MISSING"
  | "ACTIVE_LEGAL_HOLD" | "HOLD_STATUS_UNVERIFIED"
  | "CURRENT_REGISTRATION_REQUIRED" | "DEPENDENCY_UNVERIFIED"
  | "DEPENDENCY_ACTIVE" | "DEPENDENCY_UNBOUNDED"
  | "DEPENDENCY_HORIZON_OPEN" | "REVIEW_DATE_NOT_REACHED"
  | "REVIEW_ONLY_NO_DELETION_AUTHORITY";
export type EngineeringRetentionDecision = Readonly<{
  category: EngineeringRetentionCategory | "UNRECOGNIZED";
  state: EngineeringRetentionState;
  reasonCodes: readonly EngineeringRetentionReason[];
  policyVersion: string;
  earliestReviewAt: string | null;
  deletionAuthorized: false;
}>;

const DAY_MS = 86_400_000;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const knownCategories = new Set<string>(engineeringRetentionCategories);
const knownStates = new Set<EngineeringRetentionState>([
  "KEEP_REQUIRED", "WAIT_DEPENDENCIES", "WAIT_POLICY", "ELIGIBLE_FOR_REVIEW", "INVALID_INPUT"
]);
const knownReasons = new Set<EngineeringRetentionReason>([
  "INPUT_INVALID", "TIME_INVALID", "POLICY_VERSION_REVIEW", "POLICY_SCOPE_UNQUALIFIED",
  "SECURITY_CLASSIFICATION_REQUIRED", "CATEGORY_POLICY_MISSING", "ACTIVE_LEGAL_HOLD",
  "HOLD_STATUS_UNVERIFIED", "CURRENT_REGISTRATION_REQUIRED", "DEPENDENCY_UNVERIFIED",
  "DEPENDENCY_ACTIVE", "DEPENDENCY_UNBOUNDED", "DEPENDENCY_HORIZON_OPEN",
  "REVIEW_DATE_NOT_REACHED", "REVIEW_ONLY_NO_DELETION_AUTHORITY"
]);
const mediaOrSpecial = new Set<EngineeringRetentionCategory>([
  ...protectedExistingDataClasses, "CHILD_SENSITIVE_DATA"
]);
const requiredDependencies: Readonly<Record<EngineeringRetentionCategory, readonly RetentionDependencyKind[]>> = {
  REGISTRATION_VERSION: ["EVENT", "CLAIM", "EFFECT", "REPLAY", "RESTORE"],
  EVENT_ACCEPTANCE_BINDING: ["EVENT", "INCIDENT", "CLAIM", "EFFECT", "COMPLAINT", "REPLAY", "RESTORE"],
  RISK_PROCESSING: ["CLAIM", "EFFECT", "EXTERNAL_OUTCOME", "REPLAY", "RESTORE", "ROLLBACK"],
  RECIPIENT_SETTINGS_REFERENCE: ["DELIVERY", "COMPLAINT", "REPLAY", "RESTORE"],
  REGISTRATION_BUSINESS_AUDIT: ["INVESTIGATION", "RESTORE"],
  SECURITY_COMPLIANCE_LOG: ["RESTORE"],
  DEBUG_TELEMETRY: [],
  DIGITAL_OBSERVER_EVIDENCE: [],
  SOURCE_RECORDING_REFERENCE: [],
  INVESTIGATION_CASE: [],
  BIOMETRIC_TEMPLATE: [],
  CHILD_SENSITIVE_DATA: []
};

function utcMillis(value: unknown): number | null {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
    ? milliseconds : null;
}

export function addCalendarMonthsUtc(value: string, months: number): string | null {
  const timestamp = utcMillis(value);
  if (timestamp === null || !Number.isSafeInteger(months) || months < 0) return null;
  const original = new Date(timestamp);
  const monthIndex = original.getUTCFullYear() * 12 + original.getUTCMonth() + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  if (year < 100 || year > 9999) return null;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(original.getUTCDate(), lastDay),
    original.getUTCHours(), original.getUTCMinutes(), original.getUTCSeconds(),
    original.getUTCMilliseconds())).toISOString();
}

function plusDays(timestamp: number, days: number): string | null {
  const result = timestamp + days * DAY_MS;
  return Number.isFinite(result) && new Date(result).getUTCFullYear() <= 9999
    ? new Date(result).toISOString() : null;
}

function decide(category: EngineeringRetentionCategory | "UNRECOGNIZED",
  state: EngineeringRetentionState, reason: EngineeringRetentionReason,
  earliestReviewAt: string | null = null): EngineeringRetentionDecision {
  return Object.freeze({ category, state, reasonCodes: Object.freeze([reason]),
    policyVersion: ENGINEERING_RETENTION_POLICY_V1.version, earliestReviewAt,
    deletionAuthorized: false as const });
}

/** Pure review eligibility, never a deletion or legal-authority decision. */
export function evaluateEngineeringRetention(input: EngineeringRetentionInput,
  now: Date): EngineeringRetentionDecision {
  const category = knownCategories.has(input?.category) ? input.category : "UNRECOGNIZED";
  if (category === "UNRECOGNIZED" || input.authority !== "TRUSTED_SERVER"
    || !Array.isArray(input.dependencies) || !input.hold
    || !["NONE", "ACTIVE", "RELEASED", "UNKNOWN"].includes(input.hold.state)
    || !["APPLIES", "DOES_NOT_APPLY", "UNKNOWN"].includes(input.securityLogApplicability)
    || !["REAL", "SYNTHETIC_QA"].includes(input.environment)
    || typeof input.purpose !== "string" || !input.purpose.trim()
    || !Number.isFinite(now?.getTime())) return decide(category, "INVALID_INPUT", "INPUT_INVALID");
  const recorded = utcMillis(input.recordedAt);
  const closed = input.closedAt == null ? null : utcMillis(input.closedAt);
  const holdActivated = input.hold.activatedAt == null ? null : utcMillis(input.hold.activatedAt);
  const holdReviewed = input.hold.reviewedAt == null ? null : utcMillis(input.hold.reviewedAt);
  const released = input.hold.releasedAt == null ? null : utcMillis(input.hold.releasedAt);
  const registered = input.registration;
  const superseded = registered?.supersededAt == null ? null : utcMillis(registered.supersededAt);
  const sourceRetired = registered?.sourceRetiredAt == null ? null : utcMillis(registered.sourceRetiredAt);
  const datePairs = input.dependencies.map(dependency => ({ dependency,
    resolved: dependency.resolvedAt == null ? null : utcMillis(dependency.resolvedAt),
    horizon: dependency.horizonUntil == null ? null : utcMillis(dependency.horizonUntil) }));
  const nowMs = now.getTime();
  if (recorded === null || recorded > nowMs
    || (input.closedAt != null && (closed === null || closed < recorded || closed > nowMs))
    || (input.hold.activatedAt != null && (holdActivated === null || holdActivated > nowMs))
    || (input.hold.reviewedAt != null && (holdReviewed === null || holdActivated === null
      || holdReviewed < holdActivated || holdReviewed > nowMs))
    || (input.hold.state === "RELEASED" && (released === null || released < recorded || released > nowMs))
    || (released !== null && holdActivated !== null && released < holdActivated)
    || (input.hold.state === "NONE" && (holdActivated !== null || holdReviewed !== null))
    || (input.hold.state !== "RELEASED" && input.hold.releasedAt != null)
    || (registered?.supersededAt != null && (superseded === null || superseded < recorded || superseded > nowMs))
    || (registered?.sourceRetiredAt != null && (sourceRetired === null || sourceRetired < recorded || sourceRetired > nowMs))
    || new Set(datePairs.map(row => row.dependency?.kind)).size !== datePairs.length
    || datePairs.some(({ dependency, resolved, horizon }) =>
      !requiredDependencies[category].includes(dependency?.kind)
      || !["ACTIVE", "RESOLVED", "UNKNOWN", "UNBOUNDED"].includes(dependency.state)
      || (dependency.resolvedAt != null && (resolved === null || resolved < recorded || resolved > nowMs))
      || (dependency.horizonUntil != null && (horizon === null || horizon < recorded))
      || (resolved !== null && horizon !== null && horizon < resolved)
      || (dependency.state !== "RESOLVED" && (resolved !== null || horizon !== null)))) {
    return decide(category, "INVALID_INPUT", "TIME_INVALID");
  }
  if (input.hold.state === "ACTIVE") {
    return decide(category, "KEEP_REQUIRED", "ACTIVE_LEGAL_HOLD",
      holdActivated === null ? null : plusDays(holdReviewed ?? holdActivated,
        ENGINEERING_RETENTION_POLICY_V1.exceptionReviewDays));
  }
  if (input.hold.state === "UNKNOWN") return decide(category, "WAIT_POLICY", "HOLD_STATUS_UNVERIFIED");
  if (input.policyVersion !== ENGINEERING_RETENTION_POLICY_V1.version) {
    return decide(category, "WAIT_POLICY", "POLICY_VERSION_REVIEW");
  }
  if (input.jurisdiction !== ENGINEERING_RETENTION_POLICY_V1.jurisdiction
    || input.context !== ENGINEERING_RETENTION_POLICY_V1.context) {
    return decide(category, "WAIT_POLICY", "POLICY_SCOPE_UNQUALIFIED");
  }
  if (input.securityClassification == null || input.securityLogApplicability === "UNKNOWN") {
    return decide(category, "WAIT_POLICY", "SECURITY_CLASSIFICATION_REQUIRED");
  }
  if (mediaOrSpecial.has(category)) return decide(category, "WAIT_POLICY", "CATEGORY_POLICY_MISSING");
  const expectedClassification = category === "SECURITY_COMPLIANCE_LOG" ? "TECHNICAL_SECURITY_LOG"
    : category === "REGISTRATION_BUSINESS_AUDIT" ? "BUSINESS_AUDIT"
      : category === "DEBUG_TELEMETRY" ? "NON_SENSITIVE_DEBUG" : "OPERATIONAL_METADATA";
  if (input.securityClassification !== expectedClassification
    || (category === "SECURITY_COMPLIANCE_LOG") !== (input.securityLogApplicability === "APPLIES")
    || (category === "DEBUG_TELEMETRY" && input.environment !== "SYNTHETIC_QA")) {
    return decide(category, "WAIT_POLICY", "SECURITY_CLASSIFICATION_REQUIRED");
  }
  if (category === "REGISTRATION_VERSION") {
    if (!registered || typeof registered.currentVersion !== "boolean"
      || typeof registered.sourceActive !== "boolean"
      || (registered.currentVersion && registered.supersededAt != null)
      || (!registered.currentVersion && registered.supersededAt == null)
      || (registered.sourceActive && registered.sourceRetiredAt != null)) {
      return decide(category, "INVALID_INPUT", "INPUT_INVALID");
    }
    if (registered.currentVersion && registered.sourceActive) {
      return decide(category, "KEEP_REQUIRED", "CURRENT_REGISTRATION_REQUIRED");
    }
    if (registered.currentVersion && sourceRetired === null) {
      return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_UNVERIFIED");
    }
  }
  const required = requiredDependencies[category];
  if (required.some(kind => !datePairs.some(row => row.dependency.kind === kind))) {
    return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_UNVERIFIED");
  }
  if (datePairs.some(row => row.dependency.state === "UNKNOWN")) {
    return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_UNVERIFIED");
  }
  if (datePairs.some(row => row.dependency.state === "UNBOUNDED")) {
    return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_UNBOUNDED");
  }
  if (datePairs.some(row => row.dependency.state === "ACTIVE")) {
    return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_ACTIVE");
  }
  if (datePairs.some(row => row.resolved === null
    || (["REPLAY", "RESTORE"].includes(row.dependency.kind) && row.horizon === null))) {
    return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_UNVERIFIED");
  }
  let reviewAt: string | null;
  if (category === "SECURITY_COMPLIANCE_LOG") {
    reviewAt = addCalendarMonthsUtc(input.recordedAt,
      ENGINEERING_RETENTION_POLICY_V1.technicalSecurityLogMonths);
    if (reviewAt) {
      reviewAt = new Date(Math.max(Date.parse(reviewAt), released ?? recorded,
        ...datePairs.map(row => Math.max(row.resolved!, row.horizon ?? row.resolved!)))).toISOString();
    }
  } else if (category === "DEBUG_TELEMETRY") {
    const debugReviewAt = plusDays(recorded, ENGINEERING_RETENTION_POLICY_V1.syntheticDebugDays);
    reviewAt = debugReviewAt === null ? null
      : new Date(Math.max(Date.parse(debugReviewAt), released ?? recorded)).toISOString();
  } else {
    const closure = category === "REGISTRATION_VERSION"
      ? (registered!.currentVersion ? sourceRetired : superseded) : closed;
    if (closure === null) return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_UNVERIFIED");
    reviewAt = plusDays(Math.max(closure, released ?? closure, ...datePairs.map(row =>
      Math.max(row.resolved!, row.horizon ?? row.resolved!))),
    ENGINEERING_RETENTION_POLICY_V1.postClosureDays);
  }
  if (reviewAt === null) return decide(category, "INVALID_INPUT", "TIME_INVALID");
  const futureHorizon = datePairs.some(row => row.horizon !== null && row.horizon > nowMs);
  if (futureHorizon) return decide(category, "WAIT_DEPENDENCIES", "DEPENDENCY_HORIZON_OPEN", reviewAt);
  if (Date.parse(reviewAt) > nowMs) return decide(category, "KEEP_REQUIRED", "REVIEW_DATE_NOT_REACHED", reviewAt);
  return decide(category, "ELIGIBLE_FOR_REVIEW", "REVIEW_ONLY_NO_DELETION_AUTHORITY", reviewAt);
}

/** Aggregate only closed, enumerated codes; never echo input IDs or purpose. */
export function summarizeEngineeringRetentionDryRun(decisions: readonly EngineeringRetentionDecision[]) {
  const groups = new Map<string, { category: EngineeringRetentionDecision["category"];
    state: EngineeringRetentionState; reasonCode: EngineeringRetentionReason;
    count: number; nextReviewAt: string | null }>();
  for (const decision of decisions) {
    const category = knownCategories.has(decision.category) ? decision.category : "UNRECOGNIZED";
    const state = knownStates.has(decision.state) ? decision.state : "INVALID_INPUT";
    const reasonCode = knownReasons.has(decision.reasonCodes[0])
      ? decision.reasonCodes[0] : "INPUT_INVALID";
    const key = `${category}|${state}|${reasonCode}`;
    const current = groups.get(key);
    const nextReviewAt = utcMillis(decision.earliestReviewAt);
    const safeReviewAt = nextReviewAt === null ? null : new Date(nextReviewAt).toISOString();
    if (current) {
      current.count += 1;
      if (safeReviewAt && (!current.nextReviewAt || safeReviewAt < current.nextReviewAt)) {
        current.nextReviewAt = safeReviewAt;
      }
    } else groups.set(key, { category, state, reasonCode,
      count: 1, nextReviewAt: safeReviewAt });
  }
  return [...groups.values()].sort((left, right) =>
    `${left.category}|${left.state}|${left.reasonCode}`.localeCompare(
      `${right.category}|${right.state}|${right.reasonCode}`));
}
