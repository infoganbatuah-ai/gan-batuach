import { createHmac, timingSafeEqual } from "node:crypto";

export const commercialSegments = ["consumer", "small_business", "enterprise", "oem_reseller", "white_label_partner"] as const;
export const paymentProviderModes = ["disabled", "sandbox", "production"] as const;
export const commercialSubscriptionStates = ["trial", "active", "past_due", "grace_period", "suspended", "cancelled", "expired"] as const;
export const usageEvidenceClasses = ["measured", "allocated", "estimated", "unknown"] as const;
export const entitlementKeys = ["sites", "cameras", "ai_processing", "video_retention", "evidence_storage", "investigation", "notifications", "api_access", "partner_features", "white_label_features"] as const;
export const commercialInvoiceStates = ["draft", "finalized", "open", "paid", "past_due", "void", "credited", "unknown"] as const;

export type CommercialSegment = typeof commercialSegments[number];
export type PaymentProviderMode = typeof paymentProviderModes[number];
export type CommercialSubscriptionState = typeof commercialSubscriptionStates[number];
export type UsageEvidenceClass = typeof usageEvidenceClasses[number];
export type EntitlementKey = typeof entitlementKeys[number];
export type CommercialInvoiceState = typeof commercialInvoiceStates[number];

const transitions: Record<CommercialSubscriptionState, CommercialSubscriptionState[]> = {
  trial: ["active", "cancelled", "expired"],
  active: ["past_due", "suspended", "cancelled"],
  past_due: ["active", "grace_period", "suspended", "cancelled"],
  grace_period: ["active", "suspended", "cancelled", "expired"],
  suspended: ["active", "cancelled", "expired"],
  cancelled: ["active", "expired"],
  expired: []
};

export function assertSubscriptionTransition(from: CommercialSubscriptionState, to: CommercialSubscriptionState) {
  if (from === to) return;
  if (!transitions[from].includes(to)) throw new Error(`SUBSCRIPTION_TRANSITION_DENIED:${from}:${to}`);
}

const invoiceTransitions: Record<CommercialInvoiceState, CommercialInvoiceState[]> = {
  draft: ["finalized", "void"], finalized: ["open", "paid", "void", "unknown"], open: ["paid", "past_due", "void", "unknown"],
  paid: ["credited", "unknown"], past_due: ["paid", "void", "unknown"], void: [], credited: [], unknown: ["paid", "void", "credited"]
};

export function assertInvoiceTransition(from: CommercialInvoiceState, to: CommercialInvoiceState) {
  if (from === to) return;
  if (!invoiceTransitions[from].includes(to)) throw new Error(`INVOICE_TRANSITION_DENIED:${from}:${to}`);
}

export function stableCommercialId(namespace: string, ...parts: Array<string | number | null | undefined>) {
  return createHmac("sha256", `digital-observer:${namespace}:v1`).update(parts.map((part) => String(part ?? "")).join("\u001f")).digest("hex");
}

export type PlanVersion = {
  id: string;
  packageId: string;
  version: number;
  segment: CommercialSegment;
  currency: string;
  billingPeriod: "monthly" | "annual" | "contract";
  priceMinor: number | null;
  pricingStatus: "unapproved" | "approved";
  effectiveFrom: string;
  effectiveUntil?: string | null;
  limits: Partial<Record<EntitlementKey, number | boolean>>;
  overagePolicy: "deny" | "warn" | "contract";
};

export function validatePlanForCheckout(plan: PlanVersion, at = new Date()) {
  if (plan.pricingStatus !== "approved") throw new Error("PLAN_PRICE_NOT_OWNER_APPROVED");
  if (!plan.currency || plan.priceMinor === null || plan.priceMinor < 0) throw new Error("PLAN_PRICE_NOT_CONFIGURED");
  if (new Date(plan.effectiveFrom).getTime() > at.getTime()) throw new Error("PLAN_NOT_YET_EFFECTIVE");
  if (plan.effectiveUntil && new Date(plan.effectiveUntil).getTime() <= at.getTime()) throw new Error("PLAN_VERSION_EXPIRED");
  return plan;
}

export function quoteForPlan(input: { plan: PlanVersion; siteId: string; subscriptionId?: string | null; at?: Date }) {
  const at = input.at ?? new Date();
  validatePlanForCheckout(input.plan, at);
  return {
    quoteId: stableCommercialId("quote", input.siteId, input.subscriptionId, input.plan.id, input.plan.priceMinor, input.plan.currency),
    planVersionId: input.plan.id,
    amountMinor: input.plan.priceMinor!,
    currency: input.plan.currency,
    billingPeriod: input.plan.billingPeriod,
    expiresAt: new Date(at.getTime() + 15 * 60_000).toISOString(),
    providerContacted: false
  };
}

export type EntitlementDecision = { allowed: boolean; reason: string; limit: number | boolean | null; current: number | null };

export function evaluateEntitlement(input: {
  state: CommercialSubscriptionState;
  key: EntitlementKey;
  entitlements: Partial<Record<EntitlementKey, number | boolean>>;
  currentUsage?: number;
  at?: Date;
  expiresAt?: string | null;
}) : EntitlementDecision {
  if (["suspended", "cancelled", "expired"].includes(input.state)) return { allowed: false, reason: `subscription_${input.state}`, limit: null, current: input.currentUsage ?? null };
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= (input.at ?? new Date()).getTime()) return { allowed: false, reason: "entitlement_expired", limit: null, current: input.currentUsage ?? null };
  const limit = input.entitlements[input.key];
  if (limit === undefined || limit === false) return { allowed: false, reason: "entitlement_not_granted", limit: limit ?? null, current: input.currentUsage ?? null };
  if (typeof limit === "number" && (input.currentUsage ?? 0) >= limit) return { allowed: false, reason: "entitlement_limit_reached", limit, current: input.currentUsage ?? 0 };
  return { allowed: true, reason: input.state === "grace_period" || input.state === "past_due" ? "grace_policy_allows" : "entitled", limit, current: input.currentUsage ?? null };
}

export interface PaymentProviderAdapter {
  readonly key: string;
  readonly mode: PaymentProviderMode;
  createCheckout(input: { checkoutIntentId: string; amountMinor: number; currency: string; returnPath: string }): Promise<{ outcome: "disabled" | "sandbox_created" | "unknown"; providerReference: string | null; redirectUrl: string | null }>;
  requestRefund(input: { refundId: string; amountMinor: number; paymentReference: string }): Promise<{ outcome: "disabled" | "sandbox_confirmed" | "unknown"; providerReference: string | null }>;
}

class DisabledPaymentAdapter implements PaymentProviderAdapter {
  readonly mode = "disabled" as const;
  constructor(readonly key = "disabled") {}
  async createCheckout() { return { outcome: "disabled" as const, providerReference: null, redirectUrl: null }; }
  async requestRefund() { return { outcome: "disabled" as const, providerReference: null }; }
}

export class DeterministicPaymentSandboxAdapter implements PaymentProviderAdapter {
  readonly mode = "sandbox" as const;
  constructor(readonly key = "deterministic-sandbox", private readonly behavior: "success" | "unknown" = "success") {}
  async createCheckout(input: { checkoutIntentId: string }) {
    if (this.behavior === "unknown") return { outcome: "unknown" as const, providerReference: null, redirectUrl: null };
    return { outcome: "sandbox_created" as const, providerReference: `sandbox:checkout:${input.checkoutIntentId}`, redirectUrl: `/digital-observer/billing?checkout=${input.checkoutIntentId}` };
  }
  async requestRefund(input: { refundId: string }) {
    if (this.behavior === "unknown") return { outcome: "unknown" as const, providerReference: null };
    return { outcome: "sandbox_confirmed" as const, providerReference: `sandbox:refund:${input.refundId}` };
  }
}

export function paymentProviderAdapter(input?: { key?: string; mode?: PaymentProviderMode; sandboxBehavior?: "success" | "unknown" }): PaymentProviderAdapter {
  if (input?.mode === "sandbox") return new DeterministicPaymentSandboxAdapter(input.key, input.sandboxBehavior);
  if (input?.mode === "production") throw new Error("PRODUCTION_PAYMENT_PROVIDER_NOT_IMPLEMENTED_OR_AUTHORIZED");
  return new DisabledPaymentAdapter(input?.key);
}

export function signPaymentWebhook(input: { body: string; timestamp: number; providerEventId: string; secret: string }) {
  return createHmac("sha256", input.secret).update(`${input.timestamp}.${input.providerEventId}.${input.body}`).digest("hex");
}

export function verifyPaymentWebhook(input: { body: string; timestamp: number; providerEventId: string; secret: string; signature: string; now?: number; toleranceSeconds?: number }) {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - input.timestamp) > (input.toleranceSeconds ?? 300)) return { valid: false, reason: "timestamp_outside_replay_window" } as const;
  const expected = signPaymentWebhook(input);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(input.signature, "hex");
  return left.length === right.length && timingSafeEqual(left, right) ? { valid: true, reason: null } as const : { valid: false, reason: "signature_invalid" } as const;
}

export function classifyProviderEventOrder(input: {
  currentEventId?: string | null;
  currentOccurredAt?: string | null;
  incomingEventId: string;
  incomingOccurredAt: string;
}) {
  if (input.currentEventId === input.incomingEventId) return "duplicate" as const;
  if (input.currentOccurredAt && Date.parse(input.incomingOccurredAt) <= Date.parse(input.currentOccurredAt)) return "stale" as const;
  return "apply" as const;
}

export function reconcileCommercialState(input: { paymentOutcome: "confirmed" | "failed" | "refunded" | "cancelled" | "unknown"; invoiceState: string; subscriptionState: CommercialSubscriptionState; entitlementActive: boolean; graceExpiresAt?: string | null; at?: Date }) {
  const issues: string[] = [];
  if (input.paymentOutcome === "unknown") issues.push("provider_outcome_unknown");
  if (input.paymentOutcome === "confirmed" && input.invoiceState !== "paid") issues.push("invoice_not_paid");
  if (input.paymentOutcome === "confirmed" && input.subscriptionState !== "active") issues.push("subscription_not_active");
  if (input.paymentOutcome === "refunded" && !["paid", "credited"].includes(input.invoiceState)) issues.push("refund_invoice_unreconciled");
  if (input.paymentOutcome === "refunded" && input.invoiceState === "credited" && input.entitlementActive) issues.push("refunded_entitlement_active");
  if (input.paymentOutcome === "cancelled" && input.entitlementActive) issues.push("cancelled_entitlement_active");
  const boundedGrace = input.paymentOutcome === "failed" && ["past_due", "grace_period"].includes(input.subscriptionState)
    && Boolean(input.graceExpiresAt) && new Date(input.graceExpiresAt!).getTime() > (input.at ?? new Date()).getTime();
  if (["failed", "unknown"].includes(input.paymentOutcome) && input.entitlementActive && !boundedGrace) issues.push("unverified_payment_entitlement_active");
  return { status: issues.length ? "needs_review" as const : "reconciled" as const, issues };
}

export function dualCostMetrics(input: { infrastructureIls: number | null; allInIls: number | null; registeredUsers: number; activePayingUsers: number }) {
  return {
    infrastructurePerRegisteredUserIls: input.infrastructureIls === null || input.registeredUsers <= 0 ? null : input.infrastructureIls / input.registeredUsers,
    allInPerActivePayingUserIls: input.allInIls === null || input.activePayingUsers <= 0 ? null : input.allInIls / input.activePayingUsers,
    targetIls: 15,
    denominatorsDistinct: true,
    evidence: input.infrastructureIls === null || input.allInIls === null ? "unknown" as const : "measured" as const
  };
}

export function commercialScaleProjection(input: { users: 100 | 1000 | 10000 | 100000; fixedMonthlyIls: number | null; marginalMonthlyIlsPerUser: number | null; evidence: UsageEvidenceClass; ceilingIlsPerUser?: number }) {
  const projectedMonthlyIls = input.fixedMonthlyIls === null || input.marginalMonthlyIlsPerUser === null ? null : input.fixedMonthlyIls + input.users * input.marginalMonthlyIlsPerUser;
  const projectedPerUserIls = projectedMonthlyIls === null ? null : projectedMonthlyIls / input.users;
  const ceilingIlsPerUser = input.ceilingIlsPerUser ?? 15;
  return { ...input, projectedMonthlyIls, projectedPerUserIls, ceilingIlsPerUser,
    costRisk: projectedPerUserIls === null ? "unknown" as const : projectedPerUserIls > ceilingIlsPerUser ? "ceiling_exceeded" as const : "within_configured_ceiling" as const };
}

export function paymentFailurePolicy(input: { currentFailureCount: number; forceGrace?: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  const failureCount = Math.min(3, Math.max(0, input.currentFailureCount) + 1);
  const retryDelayHours = [1, 6, null][failureCount - 1] ?? null;
  const state = input.forceGrace || failureCount >= 3 ? "grace_period" as const : "past_due" as const;
  return { failureCount, state, retryDelayHours,
    nextRetryAt: retryDelayHours === null ? null : new Date(now.getTime() + retryDelayHours * 3_600_000).toISOString(),
    graceEndsAt: new Date(now.getTime() + 7 * 86_400_000).toISOString() };
}

export function controlledTrial(input: { alreadyUsed: boolean; durationDays: number; startsAt?: Date }) {
  if (input.alreadyUsed) throw new Error("TRIAL_NOT_ELIGIBLE");
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1 || input.durationDays > 30) throw new Error("TRIAL_DURATION_INVALID");
  const startsAt = input.startsAt ?? new Date();
  return {
    state: "trial" as const,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + input.durationDays * 86_400_000).toISOString(),
    paymentRequired: false
  };
}

export function planChangePolicy(input: {
  currentAmountMinor: number;
  requestedAmountMinor: number;
  currentPeriodEndsAt: string;
  providerSupportsProration: boolean;
}) {
  const upgrade = input.requestedAmountMinor > input.currentAmountMinor;
  if (upgrade && !input.providerSupportsProration) {
    return { changeType: "upgrade" as const, apply: "after_verified_payment" as const, proration: "unsupported" as const, effectiveAt: null };
  }
  if (upgrade) return { changeType: "upgrade" as const, apply: "after_verified_payment" as const, proration: "provider_calculated" as const, effectiveAt: null };
  return { changeType: "downgrade" as const, apply: "scheduled" as const, proration: "none" as const, effectiveAt: input.currentPeriodEndsAt };
}
