export const DIGITAL_OBSERVER_PRIVACY_CONTRACT = "digital-observer-privacy-compliance-v1" as const;

export const privacyContexts = [
  "HOME",
  "SMALL_BUSINESS",
  "ENTERPRISE",
  "OEM_WHITE_LABEL",
  "KINDERGARTEN",
  "AUTHORIZED_INVESTIGATION",
  "PERSONAL_SAFETY"
] as const;

export type PrivacyContext = (typeof privacyContexts)[number];

export const legalDecisionStates = [
  "TECHNICALLY_IMPLEMENTED",
  "LEGAL_REVIEW_PENDING",
  "EXTERNALLY_APPROVED",
  "PROHIBITED",
  "NOT_APPLICABLE"
] as const;

export type LegalDecisionState = (typeof legalDecisionStates)[number];

export const sensitiveCapabilities = [
  "FACE_DETECTION",
  "FACE_RECOGNITION",
  "PERSON_REIDENTIFICATION",
  "VEHICLE_REIDENTIFICATION",
  "APPEARANCE_SIMILARITY",
  "BIOMETRIC_IDENTIFICATION",
  "CHILD_SENSITIVE_MONITORING",
  "WORKPLACE_MONITORING",
  "SOURCE_RECORDING_INVESTIGATION",
  "MISSING_PERSON_INVESTIGATION",
  "GUARDIAN_LOCATION",
  "BACKGROUND_LOCATION",
  "EMERGENCY_EXTERNAL_ACTION"
] as const;

export type SensitiveCapability = (typeof sensitiveCapabilities)[number];

export const retentionDataClasses = [
  "EVENT_ALERT_METADATA",
  "DIGITAL_OBSERVER_EVIDENCE",
  "SOURCE_RECORDING_REFERENCE",
  "INVESTIGATION_CASE",
  "AUDIT_LOG",
  "NOTIFICATION_METADATA",
  "BILLING_RECORD",
  "MOBILE_IDENTIFIER",
  "LOCATION_DATA",
  "BIOMETRIC_TEMPLATE"
] as const;

export type RetentionDataClass = (typeof retentionDataClasses)[number];

export type PrivacyGateInput = {
  capability: SensitiveCapability;
  context: PrivacyContext;
  purpose: string | null | undefined;
  tenantId: string | null | undefined;
  siteId: string | null | undefined;
  policyActive: boolean;
  decisionState: LegalDecisionState | null | undefined;
  approvalScopeMatches: boolean;
  approvalExpiresAt?: string | null;
  humanReviewRequired?: boolean;
  humanReviewerId?: string | null;
};

export type PrivacyGateDecision = {
  allowed: boolean;
  reason:
    | "APPROVED"
    | "SCOPE_REQUIRED"
    | "PURPOSE_REQUIRED"
    | "POLICY_INACTIVE"
    | "EXTERNAL_APPROVAL_REQUIRED"
    | "PROHIBITED"
    | "APPROVAL_SCOPE_MISMATCH"
    | "APPROVAL_EXPIRED"
    | "HUMAN_REVIEW_REQUIRED";
  consentAloneIsSufficient: false;
};

const childRestricted = new Set<SensitiveCapability>([
  "FACE_RECOGNITION",
  "PERSON_REIDENTIFICATION",
  "BIOMETRIC_IDENTIFICATION",
  "CHILD_SENSITIVE_MONITORING"
]);

export function evaluatePrivacyGate(input: PrivacyGateInput, now = new Date()): PrivacyGateDecision {
  const deny = (reason: Exclude<PrivacyGateDecision["reason"], "APPROVED">): PrivacyGateDecision => ({
    allowed: false,
    reason,
    consentAloneIsSufficient: false
  });

  if (!input.tenantId || !input.siteId) return deny("SCOPE_REQUIRED");
  if (!input.purpose?.trim()) return deny("PURPOSE_REQUIRED");
  if (!input.policyActive) return deny("POLICY_INACTIVE");
  if (input.decisionState === "PROHIBITED") return deny("PROHIBITED");
  if (input.context === "KINDERGARTEN" && childRestricted.has(input.capability)) return deny("PROHIBITED");
  if (input.decisionState !== "EXTERNALLY_APPROVED") return deny("EXTERNAL_APPROVAL_REQUIRED");
  if (!input.approvalScopeMatches) return deny("APPROVAL_SCOPE_MISMATCH");
  if (input.approvalExpiresAt && new Date(input.approvalExpiresAt).getTime() <= now.getTime()) return deny("APPROVAL_EXPIRED");
  if (input.humanReviewRequired && !input.humanReviewerId) return deny("HUMAN_REVIEW_REQUIRED");
  return { allowed: true, reason: "APPROVED", consentAloneIsSufficient: false };
}

export type RetentionDecisionInput = {
  dataClass: RetentionDataClass;
  expiresAt: string | null;
  activeLegalHold: boolean;
  externalSystemOwnsData: boolean;
  externalDeletionConfirmed: boolean;
  policyDecision: LegalDecisionState | null;
};

export function evaluateRetentionDisposition(input: RetentionDecisionInput, now = new Date()) {
  if (input.activeLegalHold) return { action: "PRESERVE", reason: "LEGAL_HOLD" } as const;
  if (input.policyDecision !== "EXTERNALLY_APPROVED") return { action: "REVIEW", reason: "POLICY_NOT_APPROVED" } as const;
  if (!input.expiresAt || new Date(input.expiresAt).getTime() > now.getTime()) return { action: "PRESERVE", reason: "NOT_EXPIRED" } as const;
  if (input.externalSystemOwnsData && !input.externalDeletionConfirmed) {
    return { action: "RECORD_EXTERNAL_PENDING", reason: "EXTERNAL_DELETION_UNVERIFIED" } as const;
  }
  return { action: "DELETE_ELIGIBLE", reason: "EXPIRED_AND_UNHELD" } as const;
}

export function truthfulDeletionReceipt(input: {
  internalCompleted: boolean;
  externalSystems: Array<{ system: string; status: "CONFIRMED" | "PENDING" | "UNSUPPORTED" | "UNKNOWN" }>;
}) {
  const unresolved = input.externalSystems.filter((item) => item.status !== "CONFIRMED");
  return {
    status: input.internalCompleted && unresolved.length === 0 ? "COMPLETED" : "PARTIAL_OR_PENDING",
    internalCompleted: input.internalCompleted,
    unresolvedExternalSystems: unresolved
  } as const;
}

export function isLegalHoldActive(input: { status: string; startsAt: string; endsAt?: string | null }, now = new Date()) {
  return input.status === "active"
    && new Date(input.startsAt).getTime() <= now.getTime()
    && (!input.endsAt || new Date(input.endsAt).getTime() > now.getTime());
}
