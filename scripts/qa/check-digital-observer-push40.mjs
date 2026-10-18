import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const billing = await import("../../lib/domain/digital-observer/commercial-billing.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql", import.meta.url), "utf8");
const billingRoute = readFileSync(new URL("../../app/api/digital-observer/billing/route.ts", import.meta.url), "utf8");
const billingService = readFileSync(new URL("../../lib/domain/digital-observer/commercial-billing-service.ts", import.meta.url), "utf8");
const callbackRoute = readFileSync(new URL("../../app/api/digital-observer/payment-provider-callbacks/route.ts", import.meta.url), "utf8");
const camerasRoute = readFileSync(new URL("../../app/api/digital-observer/cameras/route.ts", import.meta.url), "utf8");
const notificationsRoute = readFileSync(new URL("../../app/api/digital-observer/notifications/route.ts", import.meta.url), "utf8");
const investigationRoute = readFileSync(new URL("../../app/api/digital-observer/investigation/route.ts", import.meta.url), "utf8");
const onboardingRoute = readFileSync(new URL("../../app/api/digital-observer/onboarding/route.ts", import.meta.url), "utf8");
const cloudEventsRoute = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url), "utf8");
const cloudMediaRoute = readFileSync(new URL("../../app/api/video-gateway/cloud-event-media/route.ts", import.meta.url), "utf8");
const billingPage = readFileSync(new URL("../../app/digital-observer/billing/page.tsx", import.meta.url), "utf8");
const runtimeSource = readFileSync(new URL("../../lib/domain/digital-observer/runtime.ts", import.meta.url), "utf8");
const actionForms = readFileSync(new URL("../../components/digital-observer/observer-action-forms.tsx", import.meta.url), "utf8");
const activationRegister = JSON.parse(readFileSync(new URL("../../DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json", import.meta.url), "utf8"));

for (const [from, to] of [["trial", "active"], ["active", "past_due"], ["past_due", "grace_period"], ["grace_period", "suspended"], ["suspended", "active"], ["cancelled", "expired"]]) {
  assert.doesNotThrow(() => billing.assertSubscriptionTransition(from, to));
}
assert.throws(() => billing.assertSubscriptionTransition("expired", "active"), /SUBSCRIPTION_TRANSITION_DENIED/);
assert.throws(() => billing.assertSubscriptionTransition("active", "trial"), /SUBSCRIPTION_TRANSITION_DENIED/);
assert.doesNotThrow(() => billing.assertInvoiceTransition("paid", "credited"));
assert.throws(() => billing.assertInvoiceTransition("credited", "paid"), /INVOICE_TRANSITION_DENIED/);

const approvedPlan = { id: "plan-v1", packageId: "package-a", version: 1, segment: "consumer", currency: "ILS", billingPeriod: "monthly",
  priceMinor: 1000, pricingStatus: "approved", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: null,
  limits: { sites: 1, cameras: 2, ai_processing: true, investigation: false, notifications: true }, overagePolicy: "deny" };
const quote = billing.quoteForPlan({ plan: approvedPlan, siteId: "site-a", at: new Date("2026-10-19T00:00:00Z") });
assert.equal(quote.amountMinor, 1000);
assert.equal(quote.providerContacted, false);
assert.equal(quote.quoteId, billing.quoteForPlan({ plan: approvedPlan, siteId: "site-a", at: new Date("2026-10-19T00:00:00Z") }).quoteId);
assert.throws(() => billing.quoteForPlan({ plan: { ...approvedPlan, pricingStatus: "unapproved" }, siteId: "site-a" }), /PLAN_PRICE_NOT_OWNER_APPROVED/);

assert.deepEqual(billing.evaluateEntitlement({ state: "active", key: "cameras", entitlements: { cameras: 2 }, currentUsage: 1 }).allowed, true);
assert.equal(billing.evaluateEntitlement({ state: "active", key: "cameras", entitlements: { cameras: 2 }, currentUsage: 2 }).reason, "entitlement_limit_reached");
assert.equal(billing.evaluateEntitlement({ state: "suspended", key: "notifications", entitlements: { notifications: true } }).allowed, false);
assert.equal(billing.evaluateEntitlement({ state: "active", key: "investigation", entitlements: { investigation: false } }).allowed, false);

const trial = billing.controlledTrial({ alreadyUsed: false, durationDays: 14, startsAt: new Date("2026-10-19T00:00:00Z") });
assert.equal(trial.endsAt, "2026-11-02T00:00:00.000Z");
assert.throws(() => billing.controlledTrial({ alreadyUsed: true, durationDays: 14 }), /TRIAL_NOT_ELIGIBLE/);
assert.throws(() => billing.controlledTrial({ alreadyUsed: false, durationDays: 31 }), /TRIAL_DURATION_INVALID/);

assert.equal(billing.planChangePolicy({ currentAmountMinor: 1000, requestedAmountMinor: 2000, currentPeriodEndsAt: "2026-11-01", providerSupportsProration: false }).apply, "after_verified_payment");
assert.equal(billing.planChangePolicy({ currentAmountMinor: 2000, requestedAmountMinor: 1000, currentPeriodEndsAt: "2026-11-01", providerSupportsProration: false }).apply, "scheduled");

const disabled = billing.paymentProviderAdapter();
assert.equal(disabled.mode, "disabled");
assert.equal((await disabled.createCheckout({ checkoutIntentId: "x", amountMinor: 1000, currency: "ILS", returnPath: "/" })).outcome, "disabled");
const sandbox = billing.paymentProviderAdapter({ mode: "sandbox" });
assert.equal((await sandbox.createCheckout({ checkoutIntentId: "x", amountMinor: 1000, currency: "ILS", returnPath: "/" })).outcome, "sandbox_created");
assert.throws(() => billing.paymentProviderAdapter({ mode: "production" }), /PRODUCTION_PAYMENT_PROVIDER_NOT_IMPLEMENTED_OR_AUTHORIZED/);

const body = JSON.stringify({ event_type: "checkout.payment_confirmed", checkout_stable_id: "a".repeat(64), outcome: "confirmed" });
const signature = billing.signPaymentWebhook({ body, timestamp: 1000, providerEventId: "event-a", secret: "sandbox-secret" });
assert.equal(billing.verifyPaymentWebhook({ body, timestamp: 1000, providerEventId: "event-a", secret: "sandbox-secret", signature, now: 1000 }).valid, true);
assert.equal(billing.verifyPaymentWebhook({ body, timestamp: 1000, providerEventId: "event-a", secret: "sandbox-secret", signature, now: 1400 }).reason, "timestamp_outside_replay_window");
assert.equal(billing.verifyPaymentWebhook({ body: `${body}x`, timestamp: 1000, providerEventId: "event-a", secret: "sandbox-secret", signature, now: 1000 }).valid, false);
assert.equal(billing.classifyProviderEventOrder({ currentEventId: "event-a", currentOccurredAt: "2026-10-19T00:00:00.000Z",
  incomingEventId: "event-a", incomingOccurredAt: "2026-10-19T00:01:00.000Z" }), "duplicate");
assert.equal(billing.classifyProviderEventOrder({ currentEventId: "event-b", currentOccurredAt: "2026-10-19T00:02:00.000Z",
  incomingEventId: "event-a", incomingOccurredAt: "2026-10-19T00:01:00.000Z" }), "stale");
assert.equal(billing.classifyProviderEventOrder({ currentEventId: "event-a", currentOccurredAt: "2026-10-19T00:01:00.000Z",
  incomingEventId: "event-b", incomingOccurredAt: "2026-10-19T00:02:00.000Z" }), "apply");

assert.deepEqual(billing.reconcileCommercialState({ paymentOutcome: "unknown", invoiceState: "unknown", subscriptionState: "trial", entitlementActive: false }).issues, ["provider_outcome_unknown"]);
assert.equal(billing.reconcileCommercialState({ paymentOutcome: "confirmed", invoiceState: "paid", subscriptionState: "active", entitlementActive: true }).status, "reconciled");
assert(billing.reconcileCommercialState({ paymentOutcome: "failed", invoiceState: "past_due", subscriptionState: "past_due", entitlementActive: true }).issues.includes("unverified_payment_entitlement_active"));
assert.equal(billing.reconcileCommercialState({ paymentOutcome: "failed", invoiceState: "past_due", subscriptionState: "past_due", entitlementActive: true,
  graceExpiresAt: "2026-11-01T00:00:00.000Z", at: new Date("2026-10-19T00:00:00.000Z") }).status, "reconciled");
assert.equal(billing.reconcileCommercialState({ paymentOutcome: "refunded", invoiceState: "credited", subscriptionState: "cancelled", entitlementActive: false }).status, "reconciled");
assert(billing.reconcileCommercialState({ paymentOutcome: "refunded", invoiceState: "credited", subscriptionState: "active", entitlementActive: true }).issues.includes("refunded_entitlement_active"));
assert(billing.reconcileCommercialState({ paymentOutcome: "cancelled", invoiceState: "void", subscriptionState: "cancelled", entitlementActive: true }).issues.includes("cancelled_entitlement_active"));

assert.deepEqual(billing.paymentFailurePolicy({ currentFailureCount: 0, now: new Date("2026-10-19T00:00:00.000Z") }), {
  failureCount: 1, state: "past_due", retryDelayHours: 1, nextRetryAt: "2026-10-19T01:00:00.000Z", graceEndsAt: "2026-10-26T00:00:00.000Z"
});
assert.equal(billing.paymentFailurePolicy({ currentFailureCount: 2 }).state, "grace_period");
assert.equal(billing.paymentFailurePolicy({ currentFailureCount: 2 }).nextRetryAt, null);

const costs = billing.dualCostMetrics({ infrastructureIls: 1500, allInIls: 3000, registeredUsers: 1000, activePayingUsers: 100 });
assert.equal(costs.infrastructurePerRegisteredUserIls, 1.5);
assert.equal(costs.allInPerActivePayingUserIls, 30);
assert.equal(costs.denominatorsDistinct, true);
assert.equal(billing.dualCostMetrics({ infrastructureIls: null, allInIls: null, registeredUsers: 0, activePayingUsers: 0 }).evidence, "unknown");
for (const users of [100, 1000, 10000, 100000]) {
  const projection = billing.commercialScaleProjection({ users, fixedMonthlyIls: null, marginalMonthlyIlsPerUser: null, evidence: "unknown" });
  assert.equal(projection.projectedMonthlyIls, null);
  assert.equal(projection.costRisk, "unknown");
}
assert.equal(billing.commercialScaleProjection({ users: 100, fixedMonthlyIls: 1000, marginalMonthlyIlsPerUser: 10, evidence: "estimated" }).costRisk, "ceiling_exceeded");

for (const required of [
  "digital_observer_plan_versions", "digital_observer_billing_accounts", "digital_observer_checkout_intents", "digital_observer_payment_events",
  "digital_observer_refunds", "digital_observer_entitlement_grants", "digital_observer_commercial_usage_events", "digital_observer_partner_billing_accounts",
  "digital_observer_reconciliation_runs", "digital_observer_financial_audit", "enable row level security", "pricing_status = 'unapproved'",
  "digital_observer_cost_usage_events(id)", "member_role in ('owner','admin','operator','viewer','reviewer')", "SYSTEM_BILLING",
  "camera_source_id uuid references public.digital_observer_camera_sources", "block_digital_observer_financial_history_mutation", "revoke insert, update, delete"
]) assert(migration.includes(required), `migration missing ${required}`);
assert(migration.includes("authorize_digital_observer_refund") && migration.includes("for update") && migration.includes("prior_total + p_amount_minor"));
assert(migration.includes("digital_observer_billing_sites()") && runtimeSource.includes("digital_observer_billing_sites"));

assert(billingRoute.includes("getObserverSiteAccess") && billingRoute.includes("{ billing: true }") && billingRoute.includes("idempotency_key"));
assert(billingRoute.includes("productionPaymentEnabled: false") && !billingRoute.includes("client_payment_success"));
assert(callbackRoute.includes("verifyPaymentWebhook") && callbackRoute.includes("DIGITAL_OBSERVER_PAYMENT_PROVIDER_MODE !== \"sandbox\""));
assert(callbackRoute.includes("providerKey !== configuredProviderKey"));
assert(callbackRoute.includes("applyAuthenticatedPaymentEvent") && !callbackRoute.includes("getDigitalObserverApiUser"));
assert(callbackRoute.includes("refund_stable_id") && callbackRoute.includes("Refund callback requires the stable refund identity."));
assert(callbackRoute.includes("subscription.payment_failed") && callbackRoute.includes("subscription.payment_recovered"));
assert(camerasRoute.includes('key: "cameras"') && notificationsRoute.includes('key: "notifications"') && investigationRoute.includes('key: "investigation"'));
assert(onboardingRoute.includes('key: "sites"') && cloudEventsRoute.includes('key: "ai_processing"'));
assert(cloudMediaRoute.includes('key: "evidence_storage"') && cloudMediaRoute.includes('key: "video_retention"') && cloudMediaRoute.includes("Math.min(requestedRetentionHours, entitledRetentionHours)"));
assert(billingService.includes("ensureDraftInvoice") && billingService.includes("runCommercialReconciliation") && billingService.includes("attributeCommercialUsageFromCostEvent"));
assert(billingService.includes("PAYMENT_PROVIDER_AMOUNT_MISMATCH") && billingService.includes("REFUND_ORIGINAL_PAYMENT_MISMATCH"));
assert(billingService.includes("REFUND_ENTITLEMENT_REVOCATION_FAILED") && billingService.includes("credited_amount_minor"));
assert(billingService.includes("last_provider_event_id") && billingService.includes("subscription_event_stale_ignored"));
for (const table of ["digital_observer_entitlement_grants", "digital_observer_commercial_usage_events", "digital_observer_payment_events",
  "digital_observer_refunds", "observer_subscription_change_requests", "digital_observer_checkout_intents"]) assert(runtimeSource.includes(table));
assert(billingPage.includes("זכאויות פעילות") && billingPage.includes("שימוש מיוחס") && billingPage.includes("היסטוריית תשלום ושינויים"));
assert(billingPage.includes("רשומות מסחריות פנימיות בלבד") && actionForms.includes("ObserverRefundButton"));

assert.equal(activationRegister.principles.defaultState, "DISABLED");
assert.equal(activationRegister.principles.productionActivationRequiresOwnerAuthorization, true);
assert.deepEqual(new Set(activationRegister.items.map((item) => item.id)), new Set([
  "payment-providers", "notification-providers", "real-device-actions", "mobile-push", "oem-integrations",
  "zero-install", "external-pilots", "legal-privacy-approvals", "production-deployment"
]));
assert(activationRegister.items.every((item) => item.owner && item.dependencies && item.currentState && item.requiredApproval && item.sandboxProof && item.realProof && item.costImpact && item.activationGate));

console.log("PUSH 40 deterministic QA passed: plan approval, checkout/provider fail-closed behavior, lifecycle/trials/change policy, server entitlements, webhook signature/replay/idempotency contracts, reconciliation, partner isolation schema, dual cost denominators and 100-100000 user unknown-safe projections.");
