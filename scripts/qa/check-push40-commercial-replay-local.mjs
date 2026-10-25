import test from "node:test";
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
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const { createCheckoutIntent, requestRefund } = await import("../../lib/domain/digital-observer/commercial-billing-service.ts");
const { quoteForPlan, stableCommercialId } = await import("../../lib/domain/digital-observer/commercial-billing.ts");
const checkoutInput = { siteId: "site-a", actorId: "owner-a", packageId: "package-a",
  billingPeriod: "monthly", idempotencyKey: "checkout-key-a" };
const refundInput = { siteId: "site-a", actorId: "owner-a", paymentEventId: "payment-a",
  amountMinor: 400, currency: "ILS", reason: "Owner-approved test refund", idempotencyKey: "refund-key-a" };

function plan(overrides = {}) {
  return { id: "plan-a", package_id: "package-a", version: 1, commercial_segment: "consumer",
    currency: "ILS", billing_period: "monthly", price_minor: 1000, pricing_status: "approved",
    included_entitlements: {}, overage_policy: "deny", effective_from: "2026-01-01T00:00:00Z",
    effective_until: null, ...overrides };
}

function storedCheckout(rowPlan = plan(), overrides = {}) {
  const quote = quoteForPlan({ plan: { id: rowPlan.id, packageId: rowPlan.package_id,
    version: rowPlan.version, segment: rowPlan.commercial_segment, currency: rowPlan.currency,
    billingPeriod: rowPlan.billing_period, priceMinor: rowPlan.price_minor,
    pricingStatus: rowPlan.pricing_status, effectiveFrom: rowPlan.effective_from,
    effectiveUntil: rowPlan.effective_until, limits: {}, overagePolicy: "deny" },
  siteId: checkoutInput.siteId, subscriptionId: "sub-a" });
  return { id: "checkout-a", observer_site_id: checkoutInput.siteId,
    idempotency_key: checkoutInput.idempotencyKey,
    stable_checkout_id: stableCommercialId("checkout", checkoutInput.siteId, rowPlan.id, checkoutInput.idempotencyKey),
    billing_account_id: "account-a", subscription_id: "sub-a", plan_version_id: rowPlan.id,
    amount_minor: rowPlan.price_minor, currency: rowPlan.currency, created_by: checkoutInput.actorId,
    quote_expires_at: "2026-10-26T10:15:00Z",
    metadata: { billing_period: checkoutInput.billingPeriod, package_id: checkoutInput.packageId,
      quote_subscription_id: "sub-a", quote_id: quote.quoteId }, ...overrides };
}

function storedRefund(overrides = {}) {
  return { id: "refund-a", observer_site_id: refundInput.siteId,
    idempotency_key: refundInput.idempotencyKey,
    stable_refund_id: stableCommercialId("refund", refundInput.siteId, refundInput.paymentEventId, refundInput.idempotencyKey),
    payment_event_id: refundInput.paymentEventId, amount_minor: refundInput.amountMinor,
    currency: refundInput.currency, safe_reason: refundInput.reason, requested_by: refundInput.actorId,
    refund_status: "authorized", ...overrides };
}

function fakeDatabase({ currentPlan = plan(), checkout = storedCheckout(), refund = storedRefund(),
  checkoutRace = false, refundRace = false, rpcRefund = null } = {}) {
  const state = { currentPlan, checkout, refund, checkoutReads: 0, checkoutInsertAttempts: 0,
    refundReads: 0, rpcCalls: 0, writes: 0, providerCalls: 0, checkoutRace, refundRace, rpcRefund };
  const admin = {
    from(table) {
      const filters = new Map();
      let operation = "read";
      const query = {
        select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
        lte() { return this; }, order() { return this; }, limit() { return this; },
        insert() { operation = "insert"; return this; },
        update() { operation = "update"; return this; },
        async maybeSingle() { return this.single(); },
        async single() {
          if (operation !== "read") {
            state.writes++;
            if (table === "digital_observer_checkout_intents") {
              state.checkoutInsertAttempts++;
              if (state.checkoutRace) return { data: null, error: { code: "23505" } };
            }
            throw new Error(`UNEXPECTED_WRITE:${table}`);
          }
          if (table === "digital_observer_plan_versions") {
            const row = state.currentPlan.package_id === filters.get("package_id")
              && state.currentPlan.billing_period === filters.get("billing_period")
              && state.currentPlan.pricing_status === filters.get("pricing_status") ? state.currentPlan : null;
            return { data: row, error: null };
          }
          if (table === "observer_site_subscriptions") return { data: { id: "sub-a" }, error: null };
          if (table === "observer_sites") return { data: { id: "site-a", owner_profile_id: "owner-a" }, error: null };
          if (table === "digital_observer_billing_accounts") return { data: { id: "account-a", account_status: "active" }, error: null };
          if (table === "digital_observer_checkout_intents") {
            state.checkoutReads++;
            return { data: state.checkoutRace && state.checkoutReads === 1 ? null : state.checkout, error: null };
          }
          if (table === "digital_observer_refunds") {
            state.refundReads++;
            return { data: state.refundRace && state.refundReads === 1 ? null : state.refund, error: null };
          }
          state.providerCalls++;
          throw new Error(`UNEXPECTED_TABLE:${table}`);
        }
      };
      return query;
    },
    async rpc(name) {
      assert.equal(name, "authorize_digital_observer_refund");
      state.rpcCalls++;
      if (state.refundRace) return { data: null, error: { code: "23505" } };
      return { data: state.rpcRefund, error: null };
    }
  };
  return { admin, state };
}

test("identical Checkout replay returns the persisted quote, not a fresh expiry", async () => {
  const { admin, state } = fakeDatabase();
  const result = await createCheckoutIntent(admin, checkoutInput);
  assert.equal(result.duplicate, true);
  assert.equal(result.quote.expiresAt, state.checkout.quote_expires_at);
  assert.equal(result.quote.quoteId, state.checkout.metadata.quote_id);
  assert.equal(result.providerContacted, false);
  assert.equal(state.writes + state.rpcCalls + state.providerCalls, 0);
});

test("Checkout quote identity survives a later subscription link but rejects a corrupted fingerprint", async () => {
  const linked = storedCheckout(plan(), { subscription_id: "sub-new" });
  const exact = fakeDatabase({ checkout: linked });
  assert.equal((await createCheckoutIntent(exact.admin, checkoutInput)).quote.quoteId, linked.metadata.quote_id);
  const corrupt = fakeDatabase({ checkout: storedCheckout(plan(), { subscription_id: "sub-new",
    metadata: { ...linked.metadata, quote_id: "a".repeat(64) } }) });
  await assert.rejects(createCheckoutIntent(corrupt.admin, checkoutInput), /CHECKOUT_REPLAY_INVALID/);
  assert.equal(corrupt.state.writes + corrupt.state.rpcCalls, 0);
});

test("legacy Checkout replay reconstructs only an unchanged original subscription", async () => {
  const legacy = storedCheckout(plan(), { metadata: { billing_period: "monthly" } });
  const exact = fakeDatabase({ checkout: legacy });
  assert.equal((await createCheckoutIntent(exact.admin, checkoutInput)).duplicate, true);
  const relinked = fakeDatabase({ checkout: { ...legacy, subscription_id: "sub-new" } });
  await assert.rejects(createCheckoutIntent(relinked.admin, checkoutInput), /CHECKOUT_REPLAY_INVALID/);
  assert.equal(relinked.state.writes + relinked.state.rpcCalls, 0);
});

test("same Checkout key cannot change package, period, version, amount or currency", async () => {
  const cases = [
    { input: { ...checkoutInput, packageId: "package-b" }, currentPlan: plan({ id: "plan-b", package_id: "package-b" }) },
    { input: { ...checkoutInput, billingPeriod: "annual" }, currentPlan: plan({ id: "plan-b", billing_period: "annual" }) },
    { currentPlan: plan({ id: "plan-b", version: 2 }) },
    { currentPlan: plan({ price_minor: 1200 }) },
    { currentPlan: plan({ currency: "USD" }) }
  ];
  for (const item of cases) {
    const { admin, state } = fakeDatabase({ currentPlan: item.currentPlan ?? plan() });
    await assert.rejects(createCheckoutIntent(admin, item.input ?? checkoutInput), /CHECKOUT_IDEMPOTENCY_CONFLICT/);
    assert.equal(state.writes + state.rpcCalls + state.providerCalls, 0);
  }
});

test("wrong account, actor or partial Checkout record fails closed", async () => {
  for (const row of [storedCheckout(plan(), { billing_account_id: "account-b" }),
    storedCheckout(plan(), { created_by: "owner-b" }),
    storedCheckout(plan(), { metadata: {} }),
    storedCheckout(plan(), { quote_expires_at: null })]) {
    const { admin, state } = fakeDatabase({ checkout: row });
    await assert.rejects(createCheckoutIntent(admin, checkoutInput), /CHECKOUT_(IDEMPOTENCY_CONFLICT|REPLAY_INVALID)/);
    assert.equal(state.writes + state.rpcCalls + state.providerCalls, 0);
  }
});

test("Checkout 23505 race rereads and compares before any provider operation", async () => {
  const exact = fakeDatabase({ checkoutRace: true });
  assert.equal((await createCheckoutIntent(exact.admin, checkoutInput)).duplicate, true);
  assert.equal(exact.state.checkoutInsertAttempts, 1);
  assert.equal(exact.state.providerCalls, 0);
  const conflict = fakeDatabase({ checkoutRace: true, checkout: storedCheckout(plan(), { amount_minor: 900 }) });
  await assert.rejects(createCheckoutIntent(conflict.admin, checkoutInput), /CHECKOUT_IDEMPOTENCY_CONFLICT/);
  assert.equal(conflict.state.providerCalls, 0);
});

test("identical Refund replay does not call the financial RPC or provider", async () => {
  const { admin, state } = fakeDatabase();
  const result = await requestRefund(admin, refundInput);
  assert.equal(result.duplicate, true);
  assert.equal(result.providerContacted, false);
  assert.equal(state.rpcCalls + state.writes + state.providerCalls, 0);
});

test("same Refund key cannot change payment, amount, currency, reason or actor", async () => {
  for (const changes of [{ paymentEventId: "payment-b" }, { amountMinor: 500 },
    { currency: "USD" }, { reason: "Different reason" }, { actorId: "owner-b" }]) {
    const { admin, state } = fakeDatabase();
    await assert.rejects(requestRefund(admin, { ...refundInput, ...changes }), /REFUND_IDEMPOTENCY_CONFLICT/);
    assert.equal(state.rpcCalls + state.writes + state.providerCalls, 0);
  }
});

test("partial or malformed stored Refund cannot be called a duplicate", async () => {
  for (const refund of [storedRefund({ id: null }), storedRefund({ payment_event_id: null }),
    storedRefund({ amount_minor: "NaN" }), storedRefund({ refund_status: null })]) {
    const { admin, state } = fakeDatabase({ refund });
    await assert.rejects(requestRefund(admin, refundInput), /REFUND_(REPLAY_INVALID|IDEMPOTENCY_CONFLICT)/);
    assert.equal(state.rpcCalls + state.writes + state.providerCalls, 0);
  }
});

test("Refund 23505 race rereads and compares; a conflicting RPC result is rejected", async () => {
  const exact = fakeDatabase({ refundRace: true });
  assert.equal((await requestRefund(exact.admin, refundInput)).duplicate, true);
  assert.equal(exact.state.rpcCalls, 1);
  assert.equal(exact.state.writes, 0);
  const conflict = fakeDatabase({ refundRace: true, refund: storedRefund({ amount_minor: 500 }) });
  await assert.rejects(requestRefund(conflict.admin, refundInput), /REFUND_IDEMPOTENCY_CONFLICT/);
  const returned = fakeDatabase({ refundRace: true, refund: storedRefund({ amount_minor: 500 }) });
  returned.state.refundRace = false;
  returned.state.refundReads = 1;
  returned.state.rpcRefund = storedRefund({ amount_minor: 500 });
  returned.state.refund = null;
  await assert.rejects(requestRefund(returned.admin, refundInput), /REFUND_IDEMPOTENCY_CONFLICT/);
  assert.equal(returned.state.writes, 0);
});

test("route maps semantic conflicts to 409; deployed RPC still needs transactional semantic comparison", () => {
  const route = readFileSync(new URL("../../app/api/digital-observer/billing/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql", import.meta.url), "utf8");
  assert.match(route, /message\.includes\("CONFLICT"\)/);
  assert.match(migration, /unique\(observer_site_id,idempotency_key\)/);
  assert.match(migration, /if found then return next saved; return; end if;/);
});
