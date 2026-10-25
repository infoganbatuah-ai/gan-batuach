import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "test:server-only", shortCircuit: true };
    if (specifier === "@/lib/supabase/admin") return { url: "test:admin", shortCircuit: true };
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "test:server-only" || url === "test:admin") return { format: "module", shortCircuit: true, source: "export {};" };
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const { provisionPartnerCustomer } = await import("../../lib/domain/digital-observer/partner-platform-service.ts");
const id = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const base = { partnerId: id(1), organizationId: id(2), customerOrganizationId: id(3), actorId: id(4),
  serviceAccountId: id(5), actorRole: "organization_admin", externalReference: " external-one ",
  siteIds: [id(6)], entitlementGrantIds: [id(7)], idempotencyKey: "receipt-key-one", correlationId: "synthetic-qa" };

function fixture() {
  const state = { receipt: null, customer: null, linkedSites: [], linkedGrants: [], calls: {
    customerInsertAttempts: 0, customerWrites: 0, siteWrites: 0, grantWrites: 0, receiptInserts: 0, receiptCompletes: 0, audits: 0
  }, fail: null };
  const admin = { from(table) {
    const filters = new Map();
    let op = "read"; let payload;
    const query = {
      select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      in(key, values) { filters.set(key, values); return this; }, is(key, value) { filters.set(key, value); return this; },
      neq(key, value) { filters.set(key, value); return this; },
      insert(value) { op = "insert"; payload = value; return this; },
      upsert(value) { op = "upsert"; payload = value; return this; },
      update(value) { op = "update"; payload = value; return this; },
      single() { return Promise.resolve(this.result()); }, maybeSingle() { return Promise.resolve(this.result()); },
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); },
      result() {
        if (table === "digital_observer_partner_provisioning_receipts") {
          if (op === "insert") {
            if (state.receipt) return { data: null, error: { code: "23505" } };
            state.calls.receiptInserts++;
            state.receipt = { id: id(20), result_status: "accepted", resource_type: null, resource_id: null,
              response_status: null, ...payload };
            return { data: { id: state.receipt.id }, error: null };
          }
          if (op === "update") {
            state.calls.receiptCompletes++;
            if (state.fail === "receipt-update") return { data: null, error: { code: "synthetic" } };
            if (state.fail === "receipt-zero-row" || filters.get("id") !== state.receipt.id
              || filters.get("request_hash") !== state.receipt.request_hash || filters.get("result_status") !== "accepted") {
              return { data: null, error: { code: "PGRST116" } };
            }
            Object.assign(state.receipt, payload);
            return { data: { id: state.receipt.id, result_status: state.receipt.result_status,
              resource_type: state.receipt.resource_type, resource_id: state.receipt.resource_id,
              response_status: state.receipt.response_status }, error: null };
          }
          if (state.fail === "receipt-lookup") return { data: null, error: { code: "synthetic" } };
          return { data: state.receipt, error: null };
        }
        if (table === "observer_sites") return { data: base.siteIds.map((site) => ({ id: site })), error: null };
        if (table === "digital_observer_entitlement_grants") return { data: base.entitlementGrantIds.map((grant) => ({ id: grant })), error: null };
        if (table === "digital_observer_partner_customers") {
          if (op === "insert") {
            state.calls.customerInsertAttempts++;
            if (state.fail === "customer-race") {
              // A competing insert wins the unique (partner, customer organization) constraint.
              state.customer = { id: id(22), partner_id: payload.partner_id,
                customer_organization_id: payload.customer_organization_id, idempotency_key: "other-worker-key",
                external_customer_reference_hash: "competing-reference", customer_status: "active" };
              return { data: null, error: { code: "23505" } };
            }
            if (state.customer) return { data: null, error: { code: "23505" } };
            state.calls.customerWrites++;
            state.customer = { id: id(21), customer_status: "active", ...payload };
            return { data: state.customer, error: null };
          }
          if (state.fail === "customer-lookup") return { data: null, error: { code: "synthetic" } };
          const customer = state.customer;
          return { data: customer && [...filters].every(([key, value]) => customer[key] === value) ? customer : null, error: null };
        }
        if (table === "digital_observer_partner_customer_sites") {
          if (op === "insert") { state.calls.siteWrites++; if (state.fail === "site-link") return { error: { code: "synthetic" } };
            state.linkedSites = payload.map((row) => row.observer_site_id); return { error: null }; }
          return { data: state.linkedSites.map((observer_site_id) => ({ observer_site_id })), error: null };
        }
        if (table === "digital_observer_partner_customer_entitlements") {
          if (op === "insert") { state.calls.grantWrites++; if (state.fail === "grant-link") return { error: { code: "synthetic" } };
            state.linkedGrants = payload.map((row) => row.entitlement_grant_id); return { error: null }; }
          return { data: state.linkedGrants.map((entitlement_grant_id) => ({ entitlement_grant_id })), error: null };
        }
        if (table === "digital_observer_enterprise_audit_events" && op === "insert") {
          state.calls.audits++; return { error: state.fail === "audit" ? { code: "synthetic" } : null };
        }
        throw new Error(`UNEXPECTED_QUERY:${table}:${op}`);
      }
    };
    return query;
  } };
  return { admin, state };
}

async function provision(f, overrides = {}) { return provisionPartnerCustomer(f.admin, { ...base, ...overrides }); }
function legacyHash(input = base) {
  return createHash("sha256").update(JSON.stringify({ customerOrganizationId: input.customerOrganizationId,
    siteIds: [...input.siteIds].sort(), entitlementGrantIds: [...input.entitlementGrantIds].sort() })).digest("hex");
}

test("initial provisioning completes and a matching completed receipt replays without writes", async () => {
  const f = fixture(); const first = await provision(f);
  assert.equal(first.customer.id, id(21)); assert.equal(f.state.receipt.result_status, "completed");
  assert.equal(f.state.receipt.resource_id, id(21)); assert.equal(f.state.receipt.response_status, 201);
  assert(!JSON.stringify(f.state.receipt).includes("external-one"), "reference remains hashed");
  const before = structuredClone(f.state.calls);
  const replay = await provision(f, { externalReference: "external-one" });
  assert.deepEqual(replay, { customerId: id(21), idempotentReplay: true, status: "completed" });
  assert.deepEqual(f.state.calls, before, "replay must not write customer, links, receipt or audit");
});

test("changed reference, site, grant, actor or service account cannot reuse a receipt", async () => {
  for (const change of [{ externalReference: "other-reference" }, { siteIds: [id(8)] },
    { entitlementGrantIds: [id(9)] }, { actorId: id(10) }, { serviceAccountId: id(11) }]) {
    const f = fixture(); await provision(f); const before = structuredClone(f.state.calls);
    await assert.rejects(() => provision(f, change), /PARTNER_IDEMPOTENCY_CONFLICT/);
    assert.deepEqual(f.state.calls, before);
  }
});

test("an existing customer rejects new keys and changed reference or scope without any writes", async () => {
  for (const change of [{}, { externalReference: "different-reference" }, { siteIds: [id(8)] },
    { entitlementGrantIds: [id(9)] }]) {
    const f = fixture(); await provision(f);
    const before = structuredClone(f.state);
    await assert.rejects(() => provision(f, { idempotencyKey: "new-receipt-key", ...change }), /PARTNER_CUSTOMER_CONFLICT/);
    assert.deepEqual(f.state, before, "customer, links and all receipts remain untouched");
  }
});

test("a customer inserted after preflight wins the unique constraint without being overwritten", async () => {
  const f = fixture(); f.state.fail = "customer-race";
  await assert.rejects(() => provision(f), /PARTNER_CUSTOMER_CONFLICT/);
  assert.equal(f.state.customer.id, id(22));
  assert.equal(f.state.customer.idempotency_key, "other-worker-key");
  assert.equal(f.state.calls.customerWrites, 0);
  assert.equal(f.state.calls.customerInsertAttempts, 1);
  assert.equal(f.state.calls.siteWrites, 0);
  assert.equal(f.state.calls.grantWrites, 0);
  assert.equal(f.state.calls.receiptCompletes, 0);
  assert.equal(f.state.receipt.result_status, "accepted", "the new uncompleted receipt requires reconciliation");
  const before = structuredClone(f.state); f.state.fail = null;
  await assert.rejects(() => provision(f), /PARTNER_CUSTOMER_CONFLICT/);
  assert.deepEqual(f.state, { ...before, fail: null }, "retry must not mutate the winning customer or receipt");
});

test("customer preflight lookup failure cannot create a receipt or mutate scope", async () => {
  const f = fixture(); f.state.fail = "customer-lookup";
  await assert.rejects(() => provision(f), /PARTNER_CUSTOMER_LOOKUP_FAILED/);
  assert.equal(f.state.receipt, null);
  assert.equal(f.state.customer, null);
  assert.deepEqual(f.state.linkedSites, []);
  assert.deepEqual(f.state.linkedGrants, []);
  assert.equal(f.state.calls.receiptInserts, 0);
});

test("legacy, missing, partial and malformed receipts fail closed", async () => {
  const f = fixture(); await provision(f); const before = structuredClone(f.state.calls);
  const original = structuredClone(f.state.receipt);
  const invalid = [
    { request_hash: legacyHash() }, { result_status: "accepted", resource_id: null, response_status: null },
    { result_status: "failed" }, { result_status: "unknown" }, { resource_id: null },
    { resource_type: "other" }, { response_status: 500 }, { service_account_id: id(15) }
  ];
  for (const change of invalid) {
    f.state.receipt = { ...original, ...change };
    await assert.rejects(() => provision(f), /PARTNER_IDEMPOTENCY_CONFLICT|PARTNER_RECEIPT_RECOVERY_REQUIRED/);
    assert.deepEqual(f.state.calls, before);
  }
  f.state.receipt = original; f.state.fail = "receipt-lookup";
  await assert.rejects(() => provision(f), /PARTNER_RECEIPT_RECOVERY_REQUIRED/);
  assert.deepEqual(f.state.calls, before);
});

test("completed receipt missing customer or links is not reported as success", async () => {
  const f = fixture(); await provision(f); const before = structuredClone(f.state.calls);
  f.state.customer = null;
  await assert.rejects(() => provision(f), /PARTNER_RECEIPT_RECOVERY_REQUIRED/);
  f.state.customer = { id: id(21), customer_status: "active", external_customer_reference_hash: "bad", idempotency_key: base.idempotencyKey };
  await assert.rejects(() => provision(f), /PARTNER_RECEIPT_RECOVERY_REQUIRED/);
  f.state.customer.external_customer_reference_hash = createHash("sha256").update("external-one").digest("hex");
  f.state.linkedSites = [];
  await assert.rejects(() => provision(f), /PARTNER_RECEIPT_RECOVERY_REQUIRED/);
  f.state.linkedSites = base.siteIds; f.state.linkedGrants = [];
  await assert.rejects(() => provision(f), /PARTNER_RECEIPT_RECOVERY_REQUIRED/);
  assert.deepEqual(f.state.calls, before);
});

test("link, audit or completion failure leaves accepted receipt and cannot replay as success", async () => {
  for (const failure of ["site-link", "grant-link", "audit", "receipt-update", "receipt-zero-row"]) {
    const f = fixture(); f.state.fail = failure;
    await assert.rejects(() => provision(f), /PARTNER_CUSTOMER_SCOPE_LINK_FAILED|PARTNER_AUDIT_FAILED|PARTNER_RECEIPT_FINALIZATION_FAILED/);
    assert.equal(f.state.receipt.result_status, "accepted");
    assert.equal(f.state.calls.audits, ["site-link", "grant-link"].includes(failure) ? 0 : 1);
    const before = structuredClone(f.state.calls); f.state.fail = null;
    await assert.rejects(() => provision(f), /PARTNER_RECEIPT_RECOVERY_REQUIRED/);
    assert.deepEqual(f.state.calls, before, "retry must not silently repeat partial writes");
  }
});
