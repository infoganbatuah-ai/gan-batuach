import { createHash, randomUUID } from "node:crypto";

export const PUSH39_POLICY_VERSION = "do-action-policy-v1";
export const PUSH39_WEBHOOK_VERSION = "do-webhook-v1";

export const deliveryChannels = ["in_app", "push", "email", "sms", "whatsapp", "webhook", "phone"] as const;
export type DeliveryChannel = typeof deliveryChannels[number];
export type ExternalDeliveryChannel = Exclude<DeliveryChannel, "in_app">;
export type ProviderMode = "disabled" | "sandbox" | "production";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type ProviderOutcome = "success" | "timeout" | "rate_limit" | "temporary_failure" | "permanent_failure" | "unknown_outcome" | "acknowledged" | "expired" | "cancelled" | "blocked";
export type DeliveryStatus = "queued" | "suppressed" | "awaiting_confirmation" | "dispatching" | "sent" | "delivered" | "acknowledged" | "retry_scheduled" | "unknown_outcome" | "terminal_failure" | "dead_letter" | "expired" | "cancelled";

export type RecipientAuthorization = {
  profileId: string;
  tenantId?: string | null;
  observerSiteId: string;
  activeMembership: boolean;
  memberRole: string;
  allowedSiteIds: string[];
  channelEnabled: boolean;
  channelEligible: boolean;
  consentOrLegalBasis: boolean;
  revoked: boolean;
  quietHours?: { start: string; end: string; timezone: string } | null;
  emergencyOverrideAuthorized?: boolean;
};

export type ActionProposal = {
  actionType: "notify" | "ptz" | "zoom" | "preset" | "speaker" | "siren" | "lighting" | "phone_escalation";
  parameters: Record<string, unknown>;
  sensitive: boolean;
  physical: boolean;
  requiresHumanConfirmation: boolean;
  executionAuthorized: false;
  explanation: string;
};

export type CameraActionCapability = "ptz" | "zoom" | "preset" | "speaker" | "siren" | "lighting";

export type DeliveryPlan = {
  stableDeliveryId: string;
  idempotencyKey: string;
  observerSiteId: string;
  recipientProfileId: string;
  channel: DeliveryChannel;
  providerMode: ProviderMode;
  severity: Severity;
  priority: number;
  status: DeliveryStatus;
  suppressionReason: string | null;
  authorizationSnapshot: Record<string, unknown>;
  policySnapshot: Record<string, unknown>;
  expiresAt: string;
};

const sensitiveActions = new Set(["speaker", "siren", "lighting", "phone_escalation"]);
const physicalActions = new Set(["ptz", "zoom", "preset", "speaker", "siren", "lighting"]);
const severityRank: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function isTrustedActionProvenance(value: string) {
  return ["REAL_CAMERA_AI", "HUMAN_AUTHORIZED", "SYSTEM_HEALTH", "WATCH_RULE_REVIEWED"].includes(value);
}

export function requiresHumanConfirmation(actionType: string, emergency = false) {
  return emergency || physicalActions.has(actionType) || sensitiveActions.has(actionType);
}

export function evaluateCameraActionCapability(input: {
  action: CameraActionCapability;
  capabilities?: Record<string, unknown> | null;
  presetReference?: string | null;
}) {
  const capabilities = input.capabilities ?? {};
  const supported = (key: string) => {
    const value = capabilities[key];
    return value === true || (typeof value === "object" && value !== null && !Array.isArray(value)
      && (value as Record<string, unknown>).supported === true);
  };
  const capabilityKey = input.action === "speaker" ? "twoWayAudio"
    : ["ptz", "zoom", "preset"].includes(input.action) ? "ptz" : input.action;
  if (!supported(capabilityKey)) return { allowed: false as const, reason: "unsupported_action", capabilityKey };
  if (input.action === "preset") {
    const presets = Array.isArray(capabilities.presets) ? capabilities.presets.map(String) : [];
    if (!input.presetReference || !presets.includes(input.presetReference)) return { allowed: false as const, reason: "preset_not_supported", capabilityKey };
  }
  return { allowed: true as const, reason: null, capabilityKey, requiresHumanConfirmation: true as const };
}

export function assertRecipientAuthorization(input: RecipientAuthorization, siteId: string, channel: DeliveryChannel) {
  if (input.observerSiteId !== siteId || !input.allowedSiteIds.includes(siteId)) return { allowed: false as const, reason: "scope_mismatch" };
  if (!input.activeMembership) return { allowed: false as const, reason: "inactive_membership" };
  if (input.revoked) return { allowed: false as const, reason: "recipient_revoked" };
  if (!input.channelEnabled || !input.channelEligible) return { allowed: false as const, reason: "channel_not_eligible" };
  if (!input.consentOrLegalBasis && channel !== "in_app") return { allowed: false as const, reason: "legal_basis_missing" };
  if (!["owner", "admin", "operator", "viewer"].includes(input.memberRole)) return { allowed: false as const, reason: "role_not_eligible" };
  return { allowed: true as const, reason: null };
}

function timeParts(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("INVALID_QUIET_HOURS");
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error("INVALID_QUIET_HOURS");
  return minutes;
}

export function isInQuietHours(now: Date, quietHours?: RecipientAuthorization["quietHours"]) {
  if (!quietHours) return false;
  const current = timeParts(now, quietHours.timezone);
  const start = clockMinutes(quietHours.start);
  const end = clockMinutes(quietHours.end);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function stableDeliveryIdentity(input: { siteId: string; intentId: string; recipientId: string; channel: DeliveryChannel }) {
  return createHash("sha256").update([input.siteId, input.intentId, input.recipientId, input.channel].join(":"), "utf8").digest("hex");
}

export function createDeliveryPlan(input: {
  intentId: string;
  observerSiteId: string;
  recipient: RecipientAuthorization;
  channel: DeliveryChannel;
  providerMode: ProviderMode;
  severity: Severity;
  priority: number;
  now?: Date;
  ttlSeconds?: number;
  emergencyOverrideRequested?: boolean;
}) : DeliveryPlan {
  const now = input.now ?? new Date();
  const authorization = assertRecipientAuthorization(input.recipient, input.observerSiteId, input.channel);
  const quiet = isInQuietHours(now, input.recipient.quietHours);
  const emergencyOverride = input.emergencyOverrideRequested === true
    && input.severity === "critical"
    && input.recipient.emergencyOverrideAuthorized === true;
  const disabled = input.channel !== "in_app" && input.providerMode === "disabled";
  const suppressionReason = !authorization.allowed ? authorization.reason
    : quiet && !emergencyOverride ? "quiet_hours"
      : disabled ? "provider_disabled"
        : null;
  const stableDeliveryId = stableDeliveryIdentity({ siteId: input.observerSiteId, intentId: input.intentId, recipientId: input.recipient.profileId, channel: input.channel });
  const expiresAt = new Date(now.getTime() + Math.max(60, Math.min(input.ttlSeconds ?? 3600, 86400)) * 1000).toISOString();
  return {
    stableDeliveryId,
    idempotencyKey: `delivery:${stableDeliveryId}`,
    observerSiteId: input.observerSiteId,
    recipientProfileId: input.recipient.profileId,
    channel: input.channel,
    providerMode: input.providerMode,
    severity: input.severity,
    priority: Math.max(0, Math.min(10, Math.trunc(input.priority))),
    status: suppressionReason ? "suppressed" : "queued",
    suppressionReason,
    expiresAt,
    authorizationSnapshot: {
      profile_id: input.recipient.profileId,
      active_membership: input.recipient.activeMembership,
      member_role: input.recipient.memberRole,
      channel_enabled: input.recipient.channelEnabled,
      channel_eligible: input.recipient.channelEligible,
      consent_or_legal_basis: input.recipient.consentOrLegalBasis,
      revoked: input.recipient.revoked,
      evaluated_at: now.toISOString()
    },
    policySnapshot: { policy_version: PUSH39_POLICY_VERSION, quiet_hours_applied: quiet, emergency_override_authorized: emergencyOverride }
  };
}

export function boundedBackoff(attemptNumber: number, retryAfterSeconds?: number | null) {
  const attempt = Math.max(1, Math.min(10, Math.trunc(attemptNumber)));
  const exponential = Math.min(3600, 15 * (2 ** (attempt - 1)));
  const requested = retryAfterSeconds == null ? 0 : Math.max(0, Math.min(3600, Math.trunc(retryAfterSeconds)));
  return Math.max(exponential, requested);
}

export function transitionForProviderOutcome(input: { outcome: ProviderOutcome; attemptCount: number; maxAttempts: number; expiresAt: string; now?: Date; retryAfterSeconds?: number | null }) {
  const now = input.now ?? new Date();
  if (Date.parse(input.expiresAt) <= now.getTime() || input.outcome === "expired") return { status: "expired" as DeliveryStatus, retryAt: null, terminal: true };
  if (input.outcome === "cancelled") return { status: "cancelled" as DeliveryStatus, retryAt: null, terminal: true };
  if (input.outcome === "acknowledged") return { status: "acknowledged" as DeliveryStatus, retryAt: null, terminal: true };
  if (input.outcome === "success") return { status: "sent" as DeliveryStatus, retryAt: null, terminal: false };
  if (input.outcome === "unknown_outcome") return { status: "unknown_outcome" as DeliveryStatus, retryAt: null, terminal: true };
  if (["permanent_failure", "blocked"].includes(input.outcome)) return { status: "terminal_failure" as DeliveryStatus, retryAt: null, terminal: true };
  if (input.attemptCount >= input.maxAttempts) return { status: "dead_letter" as DeliveryStatus, retryAt: null, terminal: true };
  const delay = boundedBackoff(input.attemptCount, input.retryAfterSeconds);
  return { status: "retry_scheduled" as DeliveryStatus, retryAt: new Date(now.getTime() + delay * 1000).toISOString(), terminal: false };
}

export function minimizeNotificationContent(input: { title: string; body: string; productPath?: string | null; severity: Severity }) {
  const strip = (value: string, max: number) => value
    .replace(/(?:rtsp|rtsps):\/\/\S+/gi, "[private source]")
    .replace(/(?:password|secret|token|credential|api[_ -]?key)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[authorized product link]")
    .replace(/\s+/g, " ").trim().slice(0, max);
  const productPath = input.productPath?.startsWith("/digital-observer/") && !input.productPath.startsWith("//") ? input.productPath : null;
  return { title: strip(input.title, 120), body: strip(input.body, 300), productPath, severity: input.severity, containsRawMedia: false, containsCredentials: false };
}

export function compileNaturalLanguageAction(text: string): ActionProposal {
  const normalized = text.normalize("NFKC").trim().toLowerCase();
  if (!normalized || normalized.length > 500) throw new Error("ACTION_INSTRUCTION_INVALID");
  const mappings: Array<{ action: ActionProposal["actionType"]; pattern: RegExp; parameters: Record<string, unknown>; explanation: string }> = [
    { action: "siren", pattern: /(?:siren|alarm|צופר|אזעקה)/u, parameters: { duration_ms: 3000 }, explanation: "Proposed bounded siren action; explicit confirmation and lawful-use approval are required." },
    { action: "lighting", pattern: /(?:light|spotlight|אור|תאורה)/u, parameters: { enabled: !/(?:off|כבה|לכבות)/u.test(normalized) }, explanation: "Proposed bounded light action; explicit confirmation is required." },
    { action: "speaker", pattern: /(?:speaker|say|announce|רמקול|אמור|הכרז)/u, parameters: { message_requires_review: true }, explanation: "Proposed speaker message; content is not retained from free text and requires a separate reviewed payload and authorization." },
    { action: "preset", pattern: /(?:preset|עמדה|נקודה שמורה)/u, parameters: { preset_reference: "requires_selection" }, explanation: "Proposed preset recall; a supported preset must be selected and confirmed." },
    { action: "zoom", pattern: /(?:zoom|זום|התקרב|התרחק)/u, parameters: { direction: /(?:out|התרחק)/u.test(normalized) ? "out" : "in" }, explanation: "Proposed bounded zoom action; live capability and confirmation are required." },
    { action: "ptz", pattern: /(?:pan|tilt|ptz|הזז|סובב|שמאלה|ימינה|למעלה|למטה)/u, parameters: { direction: "requires_selection", duration_ms: 250 }, explanation: "Proposed bounded PTZ action; direction, live capability and confirmation are required." },
    { action: "phone_escalation", pattern: /(?:call|phone|התקשר|טלפון|חירום)/u, parameters: {}, explanation: "Proposed phone escalation; an authorized chain and explicit emergency approval are required." },
    { action: "notify", pattern: /(?:notify|alert|send|הודע|התראה|שלח)/u, parameters: {}, explanation: "Proposed notification; recipients, channel and policy must be evaluated." }
  ];
  const match = mappings.find((candidate) => candidate.pattern.test(normalized));
  if (!match) throw new Error("ACTION_INSTRUCTION_UNSUPPORTED");
  const physical = physicalActions.has(match.action);
  const sensitive = sensitiveActions.has(match.action) || physical;
  return { actionType: match.action, parameters: match.parameters, sensitive, physical, requiresHumanConfirmation: requiresHumanConfirmation(match.action, match.action === "phone_escalation"), executionAuthorized: false, explanation: match.explanation };
}

export function nextEscalationStep(input: { currentStep: number; maxSteps: number; status: string; acknowledged: boolean; now: Date; acknowledgementDeadline?: string | null }) {
  if (input.acknowledged) return { status: "acknowledged" as const, nextStep: input.currentStep, activate: false };
  if (["cancelled", "closed", "failed", "expired"].includes(input.status)) return { status: input.status, nextStep: input.currentStep, activate: false };
  if (input.acknowledgementDeadline && Date.parse(input.acknowledgementDeadline) > input.now.getTime()) return { status: "active" as const, nextStep: input.currentStep, activate: false };
  if (input.currentStep >= input.maxSteps) return { status: "failed" as const, nextStep: input.currentStep, activate: false };
  return { status: input.currentStep === 0 ? "active" as const : "escalated" as const, nextStep: input.currentStep + 1, activate: true };
}

export function newActionIntentIdempotency(input: { siteId: string; sourceId: string; actionType: string; policyVersion?: string }) {
  return createHash("sha256").update([input.siteId, input.sourceId, input.actionType, input.policyVersion ?? PUSH39_POLICY_VERSION].join(":"), "utf8").digest("hex");
}

export function actionIntentDraft(input: { siteId: string; sourceId: string; sourceProvenance: string; actionType: string; requestedBy?: string | null; severity: Severity; proposedAction: Record<string, unknown>; emergency?: boolean }) {
  if (!isTrustedActionProvenance(input.sourceProvenance)) throw new Error("UNTRUSTED_ACTION_PROVENANCE");
  const confirmation = requiresHumanConfirmation(input.actionType, input.emergency);
  return {
    id: randomUUID(), observer_site_id: input.siteId, requested_by: input.requestedBy ?? null,
    intent_kind: physicalActions.has(input.actionType) ? "physical_action" : input.emergency ? "emergency_escalation" : "notification",
    action_type: input.actionType, severity: input.severity, priority: severityRank[input.severity] * 2,
    intent_status: confirmation ? "awaiting_confirmation" : "proposed",
    source_provenance: input.sourceProvenance, human_confirmation_required: confirmation,
    lawful_use_approval_required: Boolean(input.emergency || sensitiveActions.has(input.actionType)),
    policy_version: PUSH39_POLICY_VERSION, proposed_action: input.proposedAction,
    idempotency_key: newActionIntentIdempotency({ siteId: input.siteId, sourceId: input.sourceId, actionType: input.actionType })
  };
}
