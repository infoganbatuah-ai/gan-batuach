/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 40 tables precede generated Supabase types. */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertInvoiceTransition,
  assertSubscriptionTransition,
  classifyProviderEventOrder,
  controlledTrial,
  paymentProviderAdapter,
  paymentFailurePolicy,
  planChangePolicy,
  quoteForPlan,
  reconcileCommercialState,
  stableCommercialId,
  type CommercialSubscriptionState,
  type EntitlementKey,
  type PaymentProviderMode,
  type PlanVersion
} from "./commercial-billing";
import { queueAuthorizedDelivery } from "./notification-delivery-service";

type AnySupabase = SupabaseClient<any>;

function providerConfig() {
  const requested = (process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER_MODE || "disabled") as PaymentProviderMode;
  const mode: PaymentProviderMode = requested === "sandbox" ? "sandbox" : "disabled";
  return { key: process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER_KEY || (mode === "sandbox" ? "deterministic-sandbox" : "disabled"), mode };
}

function planFromRow(row: any): PlanVersion {
  return {
    id: row.id,
    packageId: row.package_id,
    version: row.version,
    segment: row.commercial_segment,
    currency: row.currency,
    billingPeriod: row.billing_period,
    priceMinor: row.price_minor == null ? null : Number(row.price_minor),
    pricingStatus: row.pricing_status,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    limits: row.included_entitlements || {},
    overagePolicy: row.overage_policy
  };
}

async function audit(admin: AnySupabase, input: {
  siteId: string | null; actorId?: string | null; operation: string; entityType: string; entityId: string;
  previous?: Record<string, unknown>; next?: Record<string, unknown>; providerReference?: string | null; correlationId: string;
}) {
  const result = await admin.from("digital_observer_financial_audit").insert({
    observer_site_id: input.siteId, actor_profile_id: input.actorId ?? null, actor_type: input.actorId ? "authenticated_user" : "provider_callback",
    authorization_reference: input.actorId ? "site_billing_authorization" : "authenticated_provider_webhook",
    operation: input.operation, entity_type: input.entityType, entity_id: input.entityId,
    previous_state: input.previous ?? {}, new_state: input.next ?? {}, provider_reference: input.providerReference ?? null,
    correlation_id: input.correlationId, safe_metadata: { product: "digital_observer", raw_payment_data_stored: false }
  });
  if (result.error) throw new Error("FINANCIAL_AUDIT_WRITE_FAILED");
}

async function approvedPlan(admin: AnySupabase, packageId: string, billingPeriod: "monthly" | "annual") {
  const result = await admin.from("digital_observer_plan_versions")
    .select("id,package_id,version,commercial_segment,billing_period,price_minor,currency,pricing_status,included_entitlements,overage_policy,effective_from,effective_until")
    .eq("package_id", packageId).eq("billing_period", billingPeriod).eq("pricing_status", "approved")
    .lte("effective_from", new Date().toISOString()).order("version", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("PLAN_LOOKUP_FAILED");
  if (!result.data) throw new Error("PLAN_PRICE_NOT_OWNER_APPROVED");
  return planFromRow(result.data);
}

async function billingAccount(admin: AnySupabase, input: { siteId: string; ownerId: string; segment: string }) {
  const existing = await admin.from("digital_observer_billing_accounts").select("id,account_status").eq("observer_site_id", input.siteId).maybeSingle();
  if (existing.error) throw new Error("BILLING_ACCOUNT_LOOKUP_FAILED");
  if (existing.data) return existing.data;
  const created = await admin.from("digital_observer_billing_accounts").insert({
    account_key: `do-site:${input.siteId}`, observer_site_id: input.siteId, owner_profile_id: input.ownerId,
    commercial_segment: input.segment, account_status: "active", metadata: { product: "digital_observer" }
  }).select("id,account_status").single();
  if (created.error) throw new Error("BILLING_ACCOUNT_CREATE_FAILED");
  return created.data;
}

function sameMinorAmount(stored: unknown, requested: number) {
  const amount = typeof stored === "string" && /^\d+$/.test(stored) ? Number(stored) : stored;
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount === requested;
}

function checkoutReplay(existing: any, input: {
  siteId: string; actorId: string; packageId: string; idempotencyKey: string; billingPeriod: "monthly" | "annual";
}, expected: { stableId: string; accountId: string; plan: PlanVersion; subscriptionId: string | null;
  amountMinor: number; currency: string; quoteId: string }) {
  if (typeof existing.id !== "string" || !existing.id || typeof existing.quote_expires_at !== "string"
    || !Number.isFinite(Date.parse(existing.quote_expires_at)) || typeof existing.metadata !== "object"
    || !existing.metadata || Array.isArray(existing.metadata)) {
    throw new Error("CHECKOUT_REPLAY_INVALID");
  }
  if (existing.observer_site_id !== input.siteId || existing.idempotency_key !== input.idempotencyKey
    || existing.stable_checkout_id !== expected.stableId || existing.billing_account_id !== expected.accountId
    || existing.created_by !== input.actorId || existing.plan_version_id !== expected.plan.id
    || existing.metadata.billing_period !== input.billingPeriod
    || (existing.metadata.package_id != null && existing.metadata.package_id !== input.packageId)
    || !sameMinorAmount(existing.amount_minor, expected.amountMinor) || existing.currency !== expected.currency) {
    throw new Error("CHECKOUT_IDEMPOTENCY_CONFLICT");
  }
  // Older records did not persist the quote ID. Reconstruct it only while the original subscription binding is known.
  const originalQuoteId = existing.metadata.quote_id ?? expected.quoteId;
  if (typeof originalQuoteId !== "string" || !/^[a-f0-9]{64}$/.test(originalQuoteId)
    || (existing.metadata.quote_id == null && existing.subscription_id !== expected.subscriptionId)
    || (existing.metadata.quote_id != null && existing.metadata.quote_subscription_id !== null
      && typeof existing.metadata.quote_subscription_id !== "string")
    || (existing.metadata.quote_id != null && originalQuoteId !== stableCommercialId("quote", input.siteId,
      existing.metadata.quote_subscription_id, existing.plan_version_id, expected.amountMinor, expected.currency))
    || (existing.subscription_id === expected.subscriptionId && originalQuoteId !== expected.quoteId)) {
    throw new Error("CHECKOUT_REPLAY_INVALID");
  }
  return { checkout: existing, quote: { quoteId: originalQuoteId, planVersionId: existing.plan_version_id,
    amountMinor: expected.amountMinor, currency: existing.currency, billingPeriod: input.billingPeriod,
    expiresAt: existing.quote_expires_at, providerContacted: false }, duplicate: true, providerContacted: false };
}

function refundReplay(existing: any, input: { siteId: string; actorId: string; paymentEventId: string;
  amountMinor: number; currency: string; reason: string; idempotencyKey: string }, stableRefundId: string) {
  if (typeof existing.id !== "string" || !existing.id || typeof existing.refund_status !== "string") {
    throw new Error("REFUND_REPLAY_INVALID");
  }
  if (existing.observer_site_id !== input.siteId || existing.idempotency_key !== input.idempotencyKey
    || existing.stable_refund_id !== stableRefundId || existing.payment_event_id !== input.paymentEventId
    || !sameMinorAmount(existing.amount_minor, input.amountMinor) || existing.currency !== input.currency
    || existing.requested_by !== input.actorId || existing.safe_reason !== input.reason) {
    throw new Error("REFUND_IDEMPOTENCY_CONFLICT");
  }
  return { refund: existing, duplicate: true, providerContacted: false };
}

async function ensureDraftInvoice(admin: AnySupabase, input: {
  checkoutId: string; siteId: string; ownerId: string; packageId: string; amountMinor: number; currency: string;
  billingPeriod: "monthly" | "annual" | "contract"; providerKey: string;
}) {
  const immutableInvoiceId = stableCommercialId("invoice", input.checkoutId);
  const existing = await admin.from("observer_invoices").select("id,invoice_state").eq("immutable_invoice_id", immutableInvoiceId).maybeSingle();
  if (existing.error) throw new Error("INVOICE_IDEMPOTENCY_LOOKUP_FAILED");
  if (existing.data) return existing.data;
  const created = await admin.from("observer_invoices").insert({
    immutable_invoice_id: immutableInvoiceId, invoice_number: `DO-${immutableInvoiceId.slice(0, 16).toUpperCase()}`,
    observer_site_id: input.siteId, package_id: input.packageId, site_owner_profile_id: input.ownerId,
    amount: input.amountMinor / 100, currency: input.currency,
    billing_cycle: input.billingPeriod === "annual" ? "annual" : "monthly", status: "draft", invoice_state: "draft",
    pdf_ready: false, invoice_provider: input.providerKey, tax_document_status: "not_requested",
    metadata: { internal_commercial_record: true, legal_tax_document: false, checkout_intent_id: input.checkoutId }
  }).select("id,invoice_state").single();
  if (created.error) throw new Error("INVOICE_DRAFT_CREATE_FAILED");
  return created.data;
}

export async function createCheckoutIntent(admin: AnySupabase, input: {
  siteId: string; actorId: string; packageId: string; billingPeriod: "monthly" | "annual"; idempotencyKey: string;
}) {
  const [plan, subscriptionResult, siteResult, existing] = await Promise.all([
    approvedPlan(admin, input.packageId, input.billingPeriod),
    admin.from("observer_site_subscriptions").select("id,package_id,commercial_state").eq("observer_site_id", input.siteId).maybeSingle(),
    admin.from("observer_sites").select("id,owner_profile_id").eq("id", input.siteId).single(),
    admin.from("digital_observer_checkout_intents").select("*").eq("observer_site_id", input.siteId).eq("idempotency_key", input.idempotencyKey).maybeSingle()
  ]);
  if (subscriptionResult.error || siteResult.error || !siteResult.data) throw new Error("CHECKOUT_CONTEXT_UNAVAILABLE");
  if (existing.error) throw new Error("CHECKOUT_IDEMPOTENCY_LOOKUP_FAILED");
  const quote = quoteForPlan({ plan, siteId: input.siteId, subscriptionId: subscriptionResult.data?.id });
  const stableCheckoutId = stableCommercialId("checkout", input.siteId, plan.id, input.idempotencyKey);
  if (existing.data) {
    const account = await admin.from("digital_observer_billing_accounts").select("id")
      .eq("observer_site_id", input.siteId).maybeSingle();
    if (account.error || !account.data?.id) throw new Error("CHECKOUT_REPLAY_INVALID");
    return checkoutReplay(existing.data, input, { stableId: stableCheckoutId, accountId: account.data.id, plan,
      subscriptionId: subscriptionResult.data?.id ?? null, amountMinor: quote.amountMinor, currency: quote.currency,
      quoteId: quote.quoteId });
  }
  const account = await billingAccount(admin, { siteId: input.siteId, ownerId: siteResult.data.owner_profile_id, segment: plan.segment });
  if (account.account_status !== "active") throw new Error("BILLING_ACCOUNT_INACTIVE");
  const provider = providerConfig();
  const inserted = await admin.from("digital_observer_checkout_intents").insert({
    stable_checkout_id: stableCheckoutId, idempotency_key: input.idempotencyKey, billing_account_id: account.id,
    observer_site_id: input.siteId, subscription_id: subscriptionResult.data?.id ?? null, plan_version_id: plan.id,
    provider_key: provider.key, provider_mode: provider.mode, checkout_status: "quoted", amount_minor: quote.amountMinor,
    currency: quote.currency, quote_expires_at: quote.expiresAt, created_by: input.actorId,
    metadata: { billing_period: input.billingPeriod, package_id: input.packageId,
      quote_subscription_id: subscriptionResult.data?.id ?? null,
      quote_id: quote.quoteId, client_payment_success_trusted: false }
  }).select("*").single();
  if (inserted.error?.code === "23505") {
    const raced = await admin.from("digital_observer_checkout_intents").select("*")
      .eq("observer_site_id", input.siteId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (raced.error || !raced.data) throw new Error("CHECKOUT_REPLAY_INVALID");
    return checkoutReplay(raced.data, input, { stableId: stableCheckoutId, accountId: account.id, plan,
      subscriptionId: subscriptionResult.data?.id ?? null, amountMinor: quote.amountMinor, currency: quote.currency,
      quoteId: quote.quoteId });
  }
  if (inserted.error || !inserted.data?.id) throw new Error("CHECKOUT_CREATE_FAILED");
  const adapter = paymentProviderAdapter(provider);
  const providerResult = await adapter.createCheckout({ checkoutIntentId: inserted.data.id, amountMinor: quote.amountMinor, currency: quote.currency, returnPath: "/digital-observer/billing" });
  const checkoutStatus = providerResult.outcome === "sandbox_created" ? "provider_created" : providerResult.outcome === "unknown" ? "unknown" : "quoted";
  const outcome = providerResult.outcome === "sandbox_created" ? "pending" : providerResult.outcome === "unknown" ? "unknown" : "none";
  const updated = await admin.from("digital_observer_checkout_intents").update({
    checkout_status: checkoutStatus, provider_outcome: outcome, provider_checkout_reference: providerResult.providerReference,
    updated_at: new Date().toISOString()
  }).eq("id", inserted.data.id).select("*").single();
  if (updated.error) throw new Error("CHECKOUT_PROVIDER_STATE_FAILED");
  await ensureDraftInvoice(admin, { checkoutId: inserted.data.id, siteId: input.siteId, ownerId: siteResult.data.owner_profile_id,
    packageId: plan.packageId, amountMinor: quote.amountMinor, currency: quote.currency, billingPeriod: plan.billingPeriod,
    providerKey: provider.key });
  await audit(admin, { siteId: input.siteId, actorId: input.actorId, operation: "checkout_intent_created", entityType: "checkout_intent", entityId: inserted.data.id,
    next: { checkout_status: checkoutStatus, provider_mode: provider.mode, amount_minor: quote.amountMinor, currency: quote.currency },
    providerReference: providerResult.providerReference, correlationId: stableCheckoutId });
  return { checkout: updated.data, quote, duplicate: false, providerContacted: provider.mode === "sandbox", redirectUrl: providerResult.redirectUrl };
}

async function replaceEntitlements(admin: AnySupabase, input: { siteId: string; subscriptionId: string; planVersionId: string | null; limits: Record<string, number | boolean>; sourcePaymentEventId?: string | null }) {
  const allowed: EntitlementKey[] = ["sites","cameras","ai_processing","video_retention","evidence_storage","investigation","notifications","api_access","partner_features","white_label_features"];
  const rows = allowed.map((key) => ({
    stable_grant_id: stableCommercialId("grant", input.subscriptionId, key), observer_site_id: input.siteId,
    subscription_id: input.subscriptionId, plan_version_id: input.planVersionId, entitlement_key: key,
    limit_value: typeof input.limits[key] === "number" ? input.limits[key] : null,
    boolean_value: typeof input.limits[key] === "boolean" ? input.limits[key] : null,
    grant_status: input.limits[key] === false || input.limits[key] == null ? "restricted" : "active",
    source_payment_event_id: input.sourcePaymentEventId ?? null, metadata: { server_enforced: true }
  }));
  const result = await admin.from("digital_observer_entitlement_grants").upsert(rows, { onConflict: "subscription_id,entitlement_key" });
  if (result.error) throw new Error("ENTITLEMENT_GRANT_FAILED");
}

export async function activateControlledTrial(admin: AnySupabase, input: { siteId: string; actorId: string; packageId: string; durationDays?: number }) {
  const [existing, packageResult] = await Promise.all([
    admin.from("observer_site_subscriptions").select("*").eq("observer_site_id", input.siteId).maybeSingle(),
    admin.from("observer_monitoring_packages").select("id,active,included_entitlements,catalog_version,commercial_segment").eq("id", input.packageId).eq("active", true).maybeSingle()
  ]);
  if (existing.error || packageResult.error || !packageResult.data) throw new Error("TRIAL_CONTEXT_UNAVAILABLE");
  const trial = controlledTrial({ alreadyUsed: Boolean(existing.data?.trial_start || existing.data?.metadata?.trial_ever_used), durationDays: input.durationDays ?? 14 });
  const limits = packageResult.data.included_entitlements || {};
  const payload = {
    observer_site_id: input.siteId, package_id: input.packageId, status: "trial", subscription_status: "trial",
    commercial_state: "trial", payment_provider: "disabled", payment_provider_mode: "disabled", provider_outcome: "none",
    trial_start: trial.startsAt, trial_end: trial.endsAt, package_limits_snapshot: limits, entitlement_snapshot: limits,
    current_plan_version: packageResult.data.catalog_version, metadata: { ...(existing.data?.metadata || {}), trial_ever_used: true, trial_activated_by: input.actorId },
    updated_at: new Date().toISOString()
  };
  const saved = existing.data
    ? await admin.from("observer_site_subscriptions").update(payload).eq("id", existing.data.id).select("*").single()
    : await admin.from("observer_site_subscriptions").insert(payload).select("*").single();
  if (saved.error) throw new Error("TRIAL_ACTIVATION_FAILED");
  await replaceEntitlements(admin, { siteId: input.siteId, subscriptionId: saved.data.id, planVersionId: null, limits });
  await audit(admin, { siteId: input.siteId, actorId: input.actorId, operation: "trial_activated", entityType: "subscription", entityId: saved.data.id,
    next: { commercial_state: "trial", trial_end: trial.endsAt, package_id: input.packageId }, correlationId: stableCommercialId("trial", input.siteId, trial.startsAt) });
  return saved.data;
}

export async function schedulePlanChange(admin: AnySupabase, input: { siteId: string; actorId: string; packageId: string; billingPeriod: "monthly" | "annual"; idempotencyKey: string }) {
  const [requested, currentResult] = await Promise.all([
    approvedPlan(admin, input.packageId, input.billingPeriod),
    admin.from("observer_site_subscriptions").select("id,package_id,commercial_state,current_plan_version,renewal_date,scheduled_change").eq("observer_site_id", input.siteId).maybeSingle()
  ]);
  if (currentResult.error || !currentResult.data) throw new Error("ACTIVE_SUBSCRIPTION_REQUIRED");
  const currentPlanResult = await admin.from("digital_observer_plan_versions").select("price_minor").eq("package_id", currentResult.data.package_id)
    .eq("version", currentResult.data.current_plan_version).eq("billing_period", input.billingPeriod).maybeSingle();
  const currentAmount = Number(currentPlanResult.data?.price_minor ?? 0);
  const periodEnd = currentResult.data.renewal_date || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const policy = planChangePolicy({ currentAmountMinor: currentAmount, requestedAmountMinor: requested.priceMinor!, currentPeriodEndsAt: periodEnd, providerSupportsProration: false });
  if (policy.changeType === "upgrade") return { policy, checkout: await createCheckoutIntent(admin, input) };
  const request = await admin.from("observer_subscription_change_requests").upsert({
    observer_site_id: input.siteId, subscription_id: currentResult.data.id, current_package_id: currentResult.data.package_id,
    requested_package_id: input.packageId, change_type: "downgrade", status: "scheduled", prorated_billing_ready: false,
    effective_at: policy.effectiveAt, reason: "Server-scheduled downgrade; no unsupported proration.",
    commercial_idempotency_key: input.idempotencyKey,
    metadata: { requested_by: input.actorId, idempotency_key: input.idempotencyKey, plan_version_id: requested.id }
  }, { onConflict: "observer_site_id,commercial_idempotency_key" }).select("*").single();
  if (request.error) throw new Error("PLAN_CHANGE_SCHEDULE_FAILED");
  await admin.from("observer_site_subscriptions").update({ pending_package_id: input.packageId, pending_change_effective_at: policy.effectiveAt,
    scheduled_change: { request_id: request.data.id, plan_version_id: requested.id, idempotency_key: input.idempotencyKey }, updated_at: new Date().toISOString() }).eq("id", currentResult.data.id);
  await audit(admin, { siteId: input.siteId, actorId: input.actorId, operation: "downgrade_scheduled", entityType: "subscription", entityId: currentResult.data.id,
    previous: { package_id: currentResult.data.package_id }, next: { package_id: input.packageId, effective_at: policy.effectiveAt }, correlationId: input.idempotencyKey });
  return { policy, request: request.data };
}

export async function cancelSubscription(admin: AnySupabase, input: { siteId: string; actorId: string; reason: string; idempotencyKey: string }) {
  const current = await admin.from("observer_site_subscriptions").select("id,commercial_state,renewal_date,scheduled_change").eq("observer_site_id", input.siteId).maybeSingle();
  if (current.error || !current.data) throw new Error("ACTIVE_SUBSCRIPTION_REQUIRED");
  const effectiveAt = current.data.commercial_state === "trial" ? new Date().toISOString().slice(0, 10) : current.data.renewal_date;
  const request = await admin.from("observer_subscription_change_requests").upsert({ observer_site_id: input.siteId, subscription_id: current.data.id,
    change_type: "cancel", status: "scheduled", prorated_billing_ready: false, effective_at: effectiveAt, reason: input.reason,
    commercial_idempotency_key: input.idempotencyKey,
    metadata: { requested_by: input.actorId, idempotency_key: input.idempotencyKey }
  }, { onConflict: "observer_site_id,commercial_idempotency_key" }).select("*").single();
  if (request.error) throw new Error("CANCELLATION_REQUEST_FAILED");
  await admin.from("observer_site_subscriptions").update({ scheduled_change: { request_id: request.data.id, action: "cancel", effective_at: effectiveAt }, updated_at: new Date().toISOString() }).eq("id", current.data.id);
  await audit(admin, { siteId: input.siteId, actorId: input.actorId, operation: "cancellation_scheduled", entityType: "subscription", entityId: current.data.id,
    next: { effective_at: effectiveAt }, correlationId: input.idempotencyKey });
  return request.data;
}

export async function requestRefund(admin: AnySupabase, input: { siteId: string; actorId: string; paymentEventId: string; amountMinor: number; currency: string; reason: string; idempotencyKey: string }) {
  const stableRefundId = stableCommercialId("refund", input.siteId, input.paymentEventId, input.idempotencyKey);
  const existing = await admin.from("digital_observer_refunds").select("*").eq("observer_site_id", input.siteId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.error) throw new Error("REFUND_IDEMPOTENCY_LOOKUP_FAILED");
  if (existing.data) return refundReplay(existing.data, input, stableRefundId);
  const saved = await admin.rpc("authorize_digital_observer_refund", { p_stable_refund_id: stableRefundId,
    p_idempotency_key: input.idempotencyKey, p_observer_site_id: input.siteId, p_payment_event_id: input.paymentEventId,
    p_amount_minor: input.amountMinor, p_currency: input.currency, p_safe_reason: input.reason, p_actor_profile_id: input.actorId });
  if (saved.error?.code === "23505") {
    const raced = await admin.from("digital_observer_refunds").select("*")
      .eq("observer_site_id", input.siteId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (raced.error || !raced.data) throw new Error("REFUND_REPLAY_INVALID");
    return refundReplay(raced.data, input, stableRefundId);
  }
  const refund = Array.isArray(saved.data) ? saved.data[0] : saved.data;
  if (saved.error || !refund) throw new Error(saved.error?.message?.includes("REFUND_AMOUNT_INVALID") ? "REFUND_AMOUNT_INVALID" :
    saved.error?.message?.includes("CONFIRMED_PAYMENT_REQUIRED") ? "CONFIRMED_PAYMENT_REQUIRED" : "REFUND_REQUEST_FAILED");
  refundReplay(refund, input, stableRefundId);
  await audit(admin, { siteId: input.siteId, actorId: input.actorId, operation: "refund_authorized", entityType: "refund", entityId: refund.id,
    next: { refund_status: "authorized", amount_minor: input.amountMinor, currency: input.currency }, correlationId: stableRefundId });
  return { refund, duplicate: false, providerContacted: false };
}

export async function runCommercialReconciliation(admin: AnySupabase, input: {
  siteId: string; providerKey: string; periodStart: string; periodEnd: string;
}) {
  const stableId = stableCommercialId("reconciliation", input.siteId, input.providerKey, input.periodStart, input.periodEnd);
  const existing = await admin.from("digital_observer_reconciliation_runs").select("*").eq("stable_reconciliation_id", stableId).maybeSingle();
  if (existing.error) throw new Error("RECONCILIATION_IDEMPOTENCY_LOOKUP_FAILED");
  if (existing.data) return { reconciliation: existing.data, duplicate: true };
  const [subscription, payments, invoices, usage, grants] = await Promise.all([
    admin.from("observer_site_subscriptions").select("id,commercial_state,provider_outcome").eq("observer_site_id", input.siteId).maybeSingle(),
    admin.from("digital_observer_payment_events").select("payment_outcome,amount_minor,occurred_at").eq("observer_site_id", input.siteId)
      .eq("provider_key", input.providerKey).gte("occurred_at", input.periodStart).lte("occurred_at", input.periodEnd).order("occurred_at", { ascending: false }),
    admin.from("observer_invoices").select("invoice_state,amount,credited_amount_minor,created_at").eq("observer_site_id", input.siteId)
      .gte("created_at", input.periodStart).lte("created_at", input.periodEnd).order("created_at", { ascending: false }),
    admin.from("digital_observer_commercial_usage_events").select("quantity").eq("observer_site_id", input.siteId)
      .gte("occurred_at", input.periodStart).lte("occurred_at", input.periodEnd),
    admin.from("digital_observer_entitlement_grants").select("grant_status").eq("observer_site_id", input.siteId)
  ]);
  if ([subscription, payments, invoices, usage, grants].some((result) => result.error) || !subscription.data) throw new Error("RECONCILIATION_INPUT_UNAVAILABLE");
  const latestPayment = payments.data?.[0]?.payment_outcome;
  const paymentOutcome = latestPayment === "confirmed" ? "confirmed" : latestPayment === "failed" ? "failed"
    : latestPayment === "refunded" ? "refunded" : latestPayment === "cancelled" ? "cancelled" : "unknown";
  const latestInvoice = invoices.data?.[0]?.invoice_state ?? "unknown";
  const entitlementActive = Boolean(grants.data?.some((grant: any) => grant.grant_status === "active"));
  const result = reconcileCommercialState({ paymentOutcome, invoiceState: latestInvoice,
    subscriptionState: subscription.data.commercial_state, entitlementActive });
  const paymentTotalMinor = (payments.data ?? []).reduce((sum: number, payment: any) => sum
    + (payment.payment_outcome === "confirmed" ? Number(payment.amount_minor || 0) : 0)
    - (payment.payment_outcome === "refunded" ? Number(payment.amount_minor || 0) : 0), 0);
  const invoiceTotalMinor = (invoices.data ?? []).reduce((sum: number, invoice: any) => sum
    + (["paid", "credited"].includes(invoice.invoice_state)
      ? Math.max(0, Math.round(Number(invoice.amount || 0) * 100) - Number(invoice.credited_amount_minor || 0)) : 0), 0);
  const issues = [...result.issues];
  if (paymentTotalMinor !== invoiceTotalMinor) issues.push("payment_invoice_total_mismatch");
  const saved = await admin.from("digital_observer_reconciliation_runs").insert({ stable_reconciliation_id: stableId,
    observer_site_id: input.siteId, subscription_id: subscription.data.id, provider_key: input.providerKey,
    period_start: input.periodStart.slice(0, 10), period_end: input.periodEnd.slice(0, 10),
    reconciliation_status: issues.length ? (paymentOutcome === "unknown" ? "unknown" : "needs_review") : "reconciled",
    payment_total_minor: paymentTotalMinor, invoice_total_minor: invoiceTotalMinor,
    usage_total: (usage.data ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
    entitlement_consistent: !issues.some((issue) => issue.includes("entitlement")), issues,
    evidence_class: paymentOutcome === "unknown" ? "unknown" : "measured"
  }).select("*").single();
  if (saved.error) throw new Error("RECONCILIATION_WRITE_FAILED");
  return { reconciliation: saved.data, duplicate: false };
}

async function queueBillingFailureNotice(admin: AnySupabase, input: { siteId: string; eventId: string; eventType: string }) {
  const site = await admin.from("observer_sites").select("owner_profile_id").eq("id", input.siteId).single();
  if (site.error || !site.data?.owner_profile_id) return { queued: false, reason: "site_owner_unavailable" };
  const key = stableCommercialId("billing-notification-intent", input.siteId, input.eventId, input.eventType);
  const intent = await admin.from("digital_observer_action_intents").upsert({ observer_site_id: input.siteId, requested_by: site.data.owner_profile_id,
    authorized_by: site.data.owner_profile_id, intent_kind: "notification", action_type: "notify", severity: "high", priority: 8,
    intent_status: "authorized", source_provenance: "SYSTEM_BILLING", human_confirmation_required: false,
    lawful_use_approval_required: false, idempotency_key: key, policy_snapshot: { source: "push40", automatic_external_delivery: false },
    proposed_action: { product_path: "/digital-observer/billing", event_type: input.eventType }
  }, { onConflict: "observer_site_id,idempotency_key" }).select("id").single();
  if (intent.error) return { queued: false, reason: "action_intent_failed" };
  try {
    const delivery = await queueAuthorizedDelivery(admin, { actionIntentId: intent.data.id, observerSiteId: input.siteId,
      recipientProfileId: site.data.owner_profile_id, channel: "in_app", severity: "high", priority: 8,
      title: "נדרשת בדיקה בחיוב", body: "מצב התשלום דורש בדיקה. פרטי תשלום רגישים אינם מוצגים בהתראה.", productPath: "/digital-observer/billing" });
    return { queued: true, deliveryId: delivery.delivery.id };
  } catch { return { queued: false, reason: "push39_delivery_pending" }; }
}

export async function attributeCommercialUsageFromCostEvent(admin: AnySupabase, input: {
  sourceCostUsageId: string; idempotencyKey: string; partnerBillingAccountId?: string | null;
}) {
  const existing = await admin.from("digital_observer_commercial_usage_events").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.error) throw new Error("COMMERCIAL_USAGE_IDEMPOTENCY_LOOKUP_FAILED");
  if (existing.data) return { usage: existing.data, duplicate: true };
  const source = await admin.from("digital_observer_cost_usage_events")
    .select("id,resource_type,observer_site_id,camera_source_id,execution_target_id,execution_target_class,quantity,unit,window_start,window_end,attribution_quality")
    .eq("id", input.sourceCostUsageId).single();
  if (source.error || !source.data) throw new Error("SOURCE_COST_USAGE_NOT_FOUND");
  const subscription = await admin.from("observer_site_subscriptions").select("id,package_id,current_plan_version")
    .eq("observer_site_id", source.data.observer_site_id).maybeSingle();
  if (subscription.error || !subscription.data) throw new Error("COMMERCIAL_USAGE_SUBSCRIPTION_NOT_FOUND");
  const plan = await admin.from("digital_observer_plan_versions").select("id").eq("package_id", subscription.data.package_id)
    .eq("version", subscription.data.current_plan_version).order("effective_from", { ascending: false }).limit(1).maybeSingle();
  if (plan.error) throw new Error("COMMERCIAL_USAGE_PLAN_LOOKUP_FAILED");
  if (input.partnerBillingAccountId) {
    const partner = await admin.from("digital_observer_partner_billing_accounts").select("id,account_status")
      .eq("id", input.partnerBillingAccountId).maybeSingle();
    if (partner.error || !partner.data || !["sandbox", "active"].includes(partner.data.account_status)) throw new Error("PARTNER_BILLING_ACCOUNT_UNAVAILABLE");
  }
  const evidenceMap: Record<string, "measured" | "allocated" | "estimated" | "unknown"> = {
    DIRECTLY_METERED: "measured", PROVIDER_RECONCILED: "measured", ALLOCATED: "allocated", ESTIMATED: "estimated", UNKNOWN: "unknown"
  };
  const evidence = evidenceMap[String(source.data.attribution_quality)] ?? "unknown";
  const saved = await admin.from("digital_observer_commercial_usage_events").insert({
    stable_usage_id: stableCommercialId("commercial-usage", source.data.id, input.idempotencyKey), idempotency_key: input.idempotencyKey,
    observer_site_id: source.data.observer_site_id, camera_source_id: source.data.camera_source_id,
    subscription_id: subscription.data.id, plan_version_id: plan.data?.id ?? null,
    partner_billing_account_id: input.partnerBillingAccountId ?? null, service: source.data.resource_type,
    execution_target: source.data.execution_target_id ?? source.data.execution_target_class,
    usage_category: source.data.resource_type, quantity: source.data.quantity, unit: source.data.unit, evidence_class: evidence,
    billing_period_start: String(source.data.window_start).slice(0, 10), billing_period_end: String(source.data.window_end).slice(0, 10),
    source_cost_usage_id: source.data.id, metadata: { push33_source: true, customer_price_included: false }
  }).select("*").single();
  if (saved.error) throw new Error("COMMERCIAL_USAGE_WRITE_FAILED");
  return { usage: saved.data, duplicate: false };
}

async function activateVerifiedCheckout(admin: AnySupabase, paymentEvent: any, checkout: any) {
  const planResult = await admin.from("digital_observer_plan_versions").select("*").eq("id", checkout.plan_version_id).single();
  if (planResult.error || !planResult.data || planResult.data.pricing_status !== "approved") throw new Error("VERIFIED_PLAN_UNAVAILABLE");
  const prior = await admin.from("observer_site_subscriptions").select("*").eq("observer_site_id", checkout.observer_site_id).maybeSingle();
  if (prior.error) throw new Error("SUBSCRIPTION_LOOKUP_FAILED");
  if (prior.data) assertSubscriptionTransition(prior.data.commercial_state as CommercialSubscriptionState, "active");
  const now = new Date().toISOString();
  const payload = { observer_site_id: checkout.observer_site_id, package_id: planResult.data.package_id, status: "active", subscription_status: "active",
    commercial_state: "active", payment_provider: checkout.provider_key, payment_provider_mode: checkout.provider_mode, provider_outcome: "confirmed",
    billing_cycle: planResult.data.billing_period === "annual" ? "annual" : "monthly", current_plan_version: planResult.data.version,
    entitlement_snapshot: planResult.data.included_entitlements, package_limits_snapshot: planResult.data.included_entitlements,
    lifecycle_version: Number(prior.data?.lifecycle_version || 0) + 1, updated_at: now };
  const saved = prior.data
    ? await admin.from("observer_site_subscriptions").update(payload).eq("id", prior.data.id).select("*").single()
    : await admin.from("observer_site_subscriptions").insert(payload).select("*").single();
  if (saved.error) throw new Error("SUBSCRIPTION_ACTIVATION_FAILED");
  await replaceEntitlements(admin, { siteId: checkout.observer_site_id, subscriptionId: saved.data.id, planVersionId: planResult.data.id,
    limits: planResult.data.included_entitlements || {}, sourcePaymentEventId: paymentEvent.id });
  const site = await admin.from("observer_sites").select("owner_profile_id").eq("id", checkout.observer_site_id).single();
  if (site.error || !site.data?.owner_profile_id) throw new Error("INVOICE_OWNER_LOOKUP_FAILED");
  const immutableInvoiceId = stableCommercialId("invoice", checkout.id);
  const invoiceNumber = `DO-${immutableInvoiceId.slice(0, 16).toUpperCase()}`;
  const existingInvoice = await admin.from("observer_invoices").select("id,invoice_state").eq("immutable_invoice_id", immutableInvoiceId).maybeSingle();
  if (existingInvoice.error) throw new Error("INVOICE_IDEMPOTENCY_LOOKUP_FAILED");
  if (!existingInvoice.data) {
    const invoice = await admin.from("observer_invoices").insert({
      immutable_invoice_id: immutableInvoiceId, invoice_number: invoiceNumber, observer_site_id: checkout.observer_site_id,
      subscription_id: saved.data.id, package_id: planResult.data.package_id, site_owner_profile_id: site.data.owner_profile_id,
      amount: Number(paymentEvent.amount_minor ?? checkout.amount_minor) / 100, currency: paymentEvent.currency ?? checkout.currency,
      billing_cycle: planResult.data.billing_period === "annual" ? "annual" : "monthly", status: "paid", invoice_state: "paid",
      pdf_ready: false, invoice_provider: checkout.provider_key, provider_invoice_reference: paymentEvent.provider_event_id,
      tax_document_status: "not_requested", finalized_at: now, issued_at: now, paid_at: now,
      metadata: { internal_commercial_record: true, legal_tax_document: false, checkout_intent_id: checkout.id, source_payment_event_id: paymentEvent.id }
    }).select("id").single();
    if (invoice.error) throw new Error("INVOICE_RECORD_CREATE_FAILED");
  } else if (existingInvoice.data.invoice_state !== "paid") {
    if (existingInvoice.data.invoice_state === "draft") {
      assertInvoiceTransition("draft", "finalized");
      assertInvoiceTransition("finalized", "paid");
    } else assertInvoiceTransition(existingInvoice.data.invoice_state, "paid");
    const invoice = await admin.from("observer_invoices").update({ status: "paid", invoice_state: "paid", paid_at: now, issued_at: now,
      finalized_at: now, provider_invoice_reference: paymentEvent.provider_event_id,
      metadata: { internal_commercial_record: true, legal_tax_document: false, checkout_intent_id: checkout.id, source_payment_event_id: paymentEvent.id }, updated_at: now })
      .eq("id", existingInvoice.data.id);
    if (invoice.error) throw new Error("INVOICE_RECORD_UPDATE_FAILED");
  }
  await admin.from("digital_observer_checkout_intents").update({ checkout_status: "verified", provider_outcome: "confirmed", subscription_id: saved.data.id, updated_at: now }).eq("id", checkout.id);
  return saved.data;
}

async function confirmRefund(admin: AnySupabase, input: { checkout: any; paymentEvent: any; refundStableId: string; providerReference: string }) {
  const refund = await admin.from("digital_observer_refunds").select("*").eq("stable_refund_id", input.refundStableId)
    .eq("observer_site_id", input.checkout.observer_site_id).maybeSingle();
  if (refund.error || !refund.data) throw new Error("REFUND_REQUEST_NOT_FOUND");
  if (refund.data.refund_status === "confirmed") return refund.data;
  if (!["requested", "authorized", "provider_pending", "unknown"].includes(refund.data.refund_status)) throw new Error("REFUND_STATE_NOT_CONFIRMABLE");
  const originalPayment = await admin.from("digital_observer_payment_events").select("id,checkout_intent_id,payment_outcome")
    .eq("id", refund.data.payment_event_id).single();
  if (originalPayment.error || !originalPayment.data || originalPayment.data.payment_outcome !== "confirmed" || originalPayment.data.checkout_intent_id !== input.checkout.id) {
    throw new Error("REFUND_ORIGINAL_PAYMENT_MISMATCH");
  }
  if (Number(refund.data.amount_minor) !== Number(input.paymentEvent.amount_minor) || refund.data.currency !== input.paymentEvent.currency) {
    throw new Error("REFUND_PROVIDER_AMOUNT_MISMATCH");
  }
  const updated = await admin.from("digital_observer_refunds").update({ refund_status: "confirmed", provider_reference: input.providerReference,
    updated_at: new Date().toISOString() }).eq("id", refund.data.id).select("*").single();
  if (updated.error) throw new Error("REFUND_CONFIRMATION_FAILED");
  if (refund.data.invoice_id) {
    const invoice = await admin.from("observer_invoices").select("id,invoice_state,amount,credited_amount_minor").eq("id", refund.data.invoice_id).single();
    if (invoice.error || !invoice.data) throw new Error("REFUND_INVOICE_NOT_FOUND");
    const creditedAmountMinor = Number(invoice.data.credited_amount_minor || 0) + Number(input.paymentEvent.amount_minor || 0);
    const fullyCredited = creditedAmountMinor >= Math.round(Number(invoice.data.amount || 0) * 100);
    if (fullyCredited) assertInvoiceTransition(invoice.data.invoice_state, "credited");
    const credited = await admin.from("observer_invoices").update({ invoice_state: fullyCredited ? "credited" : invoice.data.invoice_state,
      credited_amount_minor: creditedAmountMinor, credit_reference: input.providerReference, updated_at: new Date().toISOString() }).eq("id", invoice.data.id);
    if (credited.error) throw new Error("REFUND_INVOICE_UPDATE_FAILED");
    if (fullyCredited && refund.data.subscription_id) {
      const subscription = await admin.from("observer_site_subscriptions").select("id,commercial_state")
        .eq("id", refund.data.subscription_id).single();
      if (subscription.error || !subscription.data) throw new Error("REFUND_SUBSCRIPTION_NOT_FOUND");
      if (!['cancelled', 'expired'].includes(subscription.data.commercial_state)) {
        assertSubscriptionTransition(subscription.data.commercial_state, "cancelled");
        const cancelled = await admin.from("observer_site_subscriptions").update({ commercial_state: "cancelled",
          subscription_status: "cancelled", entitlement_status: "cancelled", provider_outcome: "refunded",
          next_payment_retry_at: null, updated_at: new Date().toISOString() }).eq("id", subscription.data.id);
        if (cancelled.error) throw new Error("REFUND_SUBSCRIPTION_CANCELLATION_FAILED");
      }
      const revoke = await admin.from("digital_observer_entitlement_grants").update({ grant_status: "revoked", updated_at: new Date().toISOString() })
        .eq("subscription_id", refund.data.subscription_id);
      if (revoke.error) throw new Error("REFUND_ENTITLEMENT_REVOCATION_FAILED");
    }
  }
  return updated.data;
}

async function applySubscriptionProviderState(admin: AnySupabase, input: { checkout: any; event: any; eventType: string }) {
  const current = await admin.from("observer_site_subscriptions")
    .select("id,commercial_state,payment_failure_count,grace_period_ends_at,last_provider_event_id,last_provider_event_at")
    .eq("observer_site_id", input.checkout.observer_site_id).maybeSingle();
  if (current.error || !current.data) throw new Error("SUBSCRIPTION_FOR_PROVIDER_EVENT_NOT_FOUND");
  const currentSubscription = current.data;
  const eventOrder = classifyProviderEventOrder({ currentEventId: currentSubscription.last_provider_event_id,
    currentOccurredAt: currentSubscription.last_provider_event_at, incomingEventId: input.event.id,
    incomingOccurredAt: input.event.occurred_at || input.event.created_at });
  if (eventOrder !== "apply") return eventOrder === "duplicate" ? "subscription_event_duplicate" : "subscription_event_stale_ignored";
  const now = new Date();
  const providerEventState = { last_provider_event_id: input.event.id,
    last_provider_event_at: input.event.occurred_at || input.event.created_at };
  const updateCurrentProviderState = async (payload: Record<string, unknown>) => {
    let query = admin.from("observer_site_subscriptions").update(payload).eq("id", currentSubscription.id);
    query = currentSubscription.last_provider_event_id
      ? query.eq("last_provider_event_id", currentSubscription.last_provider_event_id)
      : query.is("last_provider_event_id", null);
    const updated = await query.select("id").maybeSingle();
    if (updated.error) throw new Error("SUBSCRIPTION_PROVIDER_STATE_FAILED");
    return Boolean(updated.data);
  };
  if (input.eventType === "subscription.payment_unknown") {
    if (!await updateCurrentProviderState({ provider_outcome: "unknown", ...providerEventState, updated_at: now.toISOString() })) {
      return "subscription_event_stale_ignored";
    }
    return "subscription_payment_unknown";
  }
  if (input.eventType === "subscription.payment_recovered") {
    assertSubscriptionTransition(currentSubscription.commercial_state, "active");
    const updated = await updateCurrentProviderState({ commercial_state: "active", subscription_status: "active",
      provider_outcome: "confirmed", payment_failure_count: 0, next_payment_retry_at: null, grace_period_started_at: null,
      grace_period_ends_at: null, ...providerEventState, updated_at: now.toISOString() });
    if (!updated) return "subscription_event_stale_ignored";
    return "subscription_recovered";
  }
  if (input.eventType === "subscription.cancelled") {
    assertSubscriptionTransition(currentSubscription.commercial_state, "cancelled");
    const updated = await updateCurrentProviderState({ commercial_state: "cancelled", subscription_status: "cancelled",
      provider_outcome: "cancelled", next_payment_retry_at: null, ...providerEventState, updated_at: now.toISOString() });
    if (!updated) return "subscription_event_stale_ignored";
    const revoke = await admin.from("digital_observer_entitlement_grants").update({ grant_status: "revoked", updated_at: now.toISOString() })
      .eq("subscription_id", currentSubscription.id);
    if (revoke.error) throw new Error("SUBSCRIPTION_ENTITLEMENT_REVOCATION_FAILED");
    return "subscription_cancelled";
  }
  const policy = paymentFailurePolicy({ currentFailureCount: Number(currentSubscription.payment_failure_count || 0),
    forceGrace: input.eventType === "subscription.grace_period_started", now });
  const failureCount = policy.failureCount;
  const target: CommercialSubscriptionState = policy.state;
  assertSubscriptionTransition(currentSubscription.commercial_state, target);
  const graceEndsAt = currentSubscription.grace_period_ends_at || policy.graceEndsAt;
  const updated = await updateCurrentProviderState({ commercial_state: target, subscription_status: "pending_payment",
    provider_outcome: "failed", payment_failure_count: failureCount,
    next_payment_retry_at: policy.nextRetryAt,
    grace_period_started_at: target === "grace_period" ? now.toISOString() : null, grace_period_ends_at: graceEndsAt,
    ...providerEventState, updated_at: now.toISOString() });
  if (!updated) return "subscription_event_stale_ignored";
  return target === "grace_period" ? "subscription_grace_period_started" : "subscription_past_due";
}

export async function applyAuthenticatedPaymentEvent(admin: AnySupabase, input: {
  providerKey: string; providerMode: "sandbox"; providerEventId: string; eventType: string; checkoutStableId?: string | null;
  outcome: "confirmed" | "failed" | "unknown" | "refunded" | "cancelled"; amountMinor?: number | null; currency?: string | null;
  occurredAt?: string | null; bodyDigest: string; refundStableId?: string | null;
}) {
  const existing = await admin.from("digital_observer_payment_events").select("*").eq("provider_key", input.providerKey).eq("provider_event_id", input.providerEventId).maybeSingle();
  if (existing.error) throw new Error("PAYMENT_EVENT_IDEMPOTENCY_LOOKUP_FAILED");
  const checkoutResult = input.checkoutStableId
    ? await admin.from("digital_observer_checkout_intents").select("*").eq("stable_checkout_id", input.checkoutStableId).maybeSingle()
    : { data: null, error: null };
  if (checkoutResult.error || !checkoutResult.data) throw new Error("CHECKOUT_INTENT_NOT_FOUND");
  const checkout = checkoutResult.data;
  const stablePaymentEventId = stableCommercialId("payment-event", input.providerKey, input.providerEventId);
  if (existing.data && (existing.data.event_type !== input.eventType || existing.data.payment_outcome !== input.outcome ||
    existing.data.checkout_intent_id !== checkout.id || existing.data.safe_metadata?.body_digest !== input.bodyDigest)) {
    throw new Error("PAYMENT_EVENT_REPLAY_MISMATCH");
  }
  let event = existing.data;
  let duplicate = Boolean(existing.data);
  if (!event) {
    const inserted = await admin.from("digital_observer_payment_events").insert({ stable_payment_event_id: stablePaymentEventId,
      provider_key: input.providerKey, provider_event_id: input.providerEventId, provider_mode: input.providerMode,
      checkout_intent_id: checkout.id, observer_site_id: checkout.observer_site_id, subscription_id: checkout.subscription_id,
      event_type: input.eventType, payment_outcome: input.outcome, amount_minor: input.amountMinor ?? null, currency: input.currency ?? null,
      signature_valid: true, replay_detected: false, occurred_at: input.occurredAt ?? new Date().toISOString(), safe_metadata: { body_digest: input.bodyDigest }
    }).select("*").single();
    if (inserted.error?.code === "23505") {
      const raced = await admin.from("digital_observer_payment_events").select("*").eq("provider_key", input.providerKey)
        .eq("provider_event_id", input.providerEventId).single();
      if (raced.error || !raced.data || raced.data.safe_metadata?.body_digest !== input.bodyDigest) throw new Error("PAYMENT_EVENT_REPLAY_MISMATCH");
      event = raced.data;
      duplicate = true;
    } else if (inserted.error || !inserted.data) throw new Error("PAYMENT_EVENT_WRITE_FAILED");
    else event = inserted.data;
  }
  let effect = "recorded";
  if (input.outcome === "confirmed" && input.eventType === "checkout.payment_confirmed") {
    if (Number(input.amountMinor) !== Number(checkout.amount_minor) || input.currency !== checkout.currency) throw new Error("PAYMENT_PROVIDER_AMOUNT_MISMATCH");
    await activateVerifiedCheckout(admin, event, checkout); effect = duplicate ? "subscription_activation_reconciled" : "subscription_activated";
  } else if (input.outcome === "refunded" && input.eventType === "payment.refunded") {
    if (!input.refundStableId) throw new Error("REFUND_STABLE_ID_REQUIRED");
    await confirmRefund(admin, { checkout, paymentEvent: event, refundStableId: input.refundStableId, providerReference: input.providerEventId });
    effect = duplicate ? "refund_confirmation_reconciled" : "refund_confirmed";
  } else if (input.eventType.startsWith("subscription.")) {
    effect = await applySubscriptionProviderState(admin, { checkout, event, eventType: input.eventType });
    if (["failed", "unknown"].includes(input.outcome) && !effect.endsWith("ignored") && !effect.endsWith("duplicate")) {
      await queueBillingFailureNotice(admin, { siteId: checkout.observer_site_id, eventId: event.id, eventType: input.eventType });
    }
  } else if (["failed", "unknown"].includes(input.outcome)) {
    await admin.from("digital_observer_checkout_intents").update({ checkout_status: input.outcome, provider_outcome: input.outcome, updated_at: new Date().toISOString() }).eq("id", checkout.id);
    await queueBillingFailureNotice(admin, { siteId: checkout.observer_site_id, eventId: event.id, eventType: input.eventType });
    effect = input.outcome === "unknown" ? "unknown_pending_reconciliation" : "failure_notification_queued";
  } else if (input.outcome === "cancelled") {
    await admin.from("digital_observer_checkout_intents").update({ checkout_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", checkout.id);
    effect = "checkout_cancelled";
  }
  if (!duplicate) await audit(admin, { siteId: checkout.observer_site_id, operation: "provider_payment_event", entityType: "payment_event", entityId: event.id,
    next: { event_type: input.eventType, payment_outcome: input.outcome, effect }, providerReference: input.providerEventId, correlationId: stablePaymentEventId });
  return { event, duplicate, effect };
}

export async function assertCommercialEntitlement(admin: AnySupabase, input: { siteId: string; key: EntitlementKey; currentUsage?: number }) {
  const subscription = await admin.from("observer_site_subscriptions").select("id,commercial_state,entitlement_snapshot,trial_end,grace_period_ends_at").eq("observer_site_id", input.siteId).maybeSingle();
  if (subscription.error || !subscription.data) throw new Error("COMMERCIAL_SUBSCRIPTION_REQUIRED");
  const { evaluateEntitlement } = await import("./commercial-billing");
  const decision = evaluateEntitlement({ state: subscription.data.commercial_state, key: input.key,
    entitlements: subscription.data.entitlement_snapshot || {}, currentUsage: input.currentUsage,
    expiresAt: subscription.data.commercial_state === "trial" ? subscription.data.trial_end
      : ["past_due", "grace_period"].includes(subscription.data.commercial_state) ? subscription.data.grace_period_ends_at : null });
  if (!decision.allowed) throw new Error(`ENTITLEMENT_DENIED:${input.key}:${decision.reason}`);
  return decision;
}
