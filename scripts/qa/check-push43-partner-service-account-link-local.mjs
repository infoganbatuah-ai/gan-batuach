import test from "node:test";
import assert from "node:assert/strict";
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

const { linkPartnerServiceAccount, authorizePartnerDelegatedSite } = await import("../../lib/domain/digital-observer/partner-platform-service.ts");
const id = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const base = { partnerId: id(1), organizationId: id(2), actorId: id(3), actorRole: "organization_admin",
  serviceAccountId: id(4), correlationId: "synthetic-link-qa" };
const customerId = id(5);
const desired = (customer = null) => ({ partner_id: base.partnerId, service_account_id: base.serviceAccountId,
  partner_customer_id: customer, access_kind: customer ? "customer_resources" : "partner_control" });

function fixture() {
  const state = {
    account: { id: base.serviceAccountId, organization_id: base.organizationId, account_status: "active" },
    partner: { id: base.partnerId, organization_id: base.organizationId, partner_status: "sandbox" },
    customer: { id: customerId, partner_id: base.partnerId, customer_organization_id: id(6), customer_status: "active" },
    customerOrganization: { id: id(6), status: "active" },
    site: { id: id(7), digital_observer_organization_id: id(6), site_type: "home", garden_id: null },
    customerSiteLink: { partner_customer_id: customerId, observer_site_id: id(7) },
    mapping: null, fail: null, raceMapping: null, calls: { insertAttempts: 0, ownMappingWrites: 0, audits: 0 }
  };
  const rows = {
    digital_observer_service_accounts: () => state.account,
    digital_observer_partners: () => state.partner,
    digital_observer_partner_customers: () => state.customer,
    digital_observer_partner_service_accounts: () => state.mapping,
    digital_observer_organizations: () => state.customerOrganization,
    observer_sites: () => state.site,
    digital_observer_partner_customer_sites: () => state.customerSiteLink
  };
  const admin = { from(table) {
    const filters = new Map(); const exclusions = new Map(); let op = "read"; let payload;
    const query = {
      select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      is(key, value) { filters.set(key, value); return this; },
      neq(key, value) { exclusions.set(key, value); return this; },
      insert(value) { op = "insert"; payload = value; return this; },
      maybeSingle() { return Promise.resolve(this.result()); }, single() { return Promise.resolve(this.result()); },
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); },
      result() {
        if (table === "digital_observer_enterprise_audit_events") {
          assert.equal(op, "insert"); state.calls.audits++; return { error: null };
        }
        if (!(table in rows)) throw new Error(`UNEXPECTED_TABLE:${table}`);
        if (op === "insert") {
          assert.equal(table, "digital_observer_partner_service_accounts");
          state.calls.insertAttempts++;
          if (state.fail === "insert-race") {
            state.mapping = structuredClone(state.raceMapping);
            return { data: null, error: { code: "23505" } };
          }
          if (state.fail === "insert-error") return { data: null, error: { code: "synthetic" } };
          if (state.mapping) return { data: null, error: { code: "23505" } };
          state.mapping = structuredClone(payload); state.calls.ownMappingWrites++;
          return { data: state.mapping, error: null };
        }
        if (state.fail === `${table}-lookup`) return { data: null, error: { code: "synthetic" } };
        const row = rows[table]();
        return { data: row && [...filters].every(([key, value]) => row[key] === value)
          && [...exclusions].every(([key, value]) => row[key] !== value) ? row : null, error: null };
      }
    };
    return query;
  } };
  return { admin, state };
}
async function link(f, overrides = {}) { return linkPartnerServiceAccount(f.admin, { ...base, ...overrides }); }
function noWrites(f) { assert.deepEqual(f.state.calls, { insertAttempts: 0, ownMappingWrites: 0, audits: 0 }); }

test("valid partner-control link is insert-only and exact repeat does not write", async () => {
  const f = fixture();
  assert.deepEqual(await link(f), desired());
  assert.deepEqual(f.state.calls, { insertAttempts: 1, ownMappingWrites: 1, audits: 1 });
  const before = structuredClone(f.state);
  assert.deepEqual(await link(f), desired());
  assert.deepEqual(f.state, before);
});

test("active customer of the same partner can receive a bounded customer-resources mapping", async () => {
  const f = fixture();
  assert.deepEqual(await link(f, { customerId }), desired(customerId));
  const before = structuredClone(f.state);
  assert.deepEqual(await link(f, { customerId }), desired(customerId));
  assert.deepEqual(f.state, before);
});

test("foreign or suspended partner and foreign service account fail before mapping writes", async () => {
  for (const change of [
    (s) => { s.partner.organization_id = id(9); },
    (s) => { s.partner.partner_status = "suspended"; },
    (s) => { s.account.organization_id = id(9); },
    (s) => { s.account.account_status = "revoked"; }
  ]) {
    const f = fixture(); change(f.state);
    await assert.rejects(() => link(f), /PARTNER_SERVICE_ACCOUNT_DENIED/);
    noWrites(f); assert.equal(f.state.mapping, null);
  }
});

test("foreign, inactive or self-owned customer cannot acquire delegated customer scope", async () => {
  for (const change of [
    (s) => { s.customer.partner_id = id(9); },
    (s) => { s.customer.customer_status = "suspended"; },
    (s) => { s.customer.customer_organization_id = base.organizationId; },
    (s) => { s.customer.customer_organization_id = null; },
    (s) => { s.customerOrganization.status = "suspended"; },
    (s) => { s.customerOrganization.id = id(9); }
  ]) {
    const f = fixture(); change(f.state);
    await assert.rejects(() => link(f, { customerId }), /PARTNER_CUSTOMER_SCOPE_DENIED/);
    noWrites(f); assert.equal(f.state.mapping, null);
  }
});

test("an existing mapping cannot silently change partner, customer or access kind", async () => {
  for (const existing of [desired(), desired(customerId),
    { ...desired(customerId), partner_id: id(9) },
    { ...desired(customerId), partner_customer_id: id(10) },
    { ...desired(), access_kind: "customer_resources" }]) {
    const f = fixture(); f.state.mapping = structuredClone(existing);
    const request = existing.partner_customer_id === customerId ? {} : { customerId };
    if (existing.partner_customer_id === customerId) request.customerId = null;
    const before = structuredClone(f.state);
    await assert.rejects(() => link(f, request), /PARTNER_SERVICE_ACCOUNT_CONFLICT/);
    assert.deepEqual(f.state, before);
  }
});

test("lookup errors fail closed without mapping or audit writes", async () => {
  for (const table of ["digital_observer_service_accounts", "digital_observer_partners",
    "digital_observer_partner_customers", "digital_observer_organizations", "digital_observer_partner_service_accounts"]) {
    const f = fixture(); f.state.fail = `${table}-lookup`;
    await assert.rejects(() => link(f, { customerId }), /LOOKUP_FAILED/);
    noWrites(f);
  }
});

test("delegated Site access requires the full account, partner, customer and Site ownership chain", async () => {
  const make = () => {
    const f = fixture();
    f.state.mapping = { ...desired(customerId), digital_observer_partner_customers: {
      ...f.state.customer, digital_observer_partners: { ...f.state.partner }
    } };
    return f;
  };
  const valid = make();
  assert.equal(await authorizePartnerDelegatedSite(valid.admin, { serviceAccountId: base.serviceAccountId, siteId: id(7) }), true);
  noWrites(valid);
  for (const change of [
    (s) => { s.mapping.partner_id = id(9); },
    (s) => { s.mapping.partner_customer_id = id(9); },
    (s) => { s.mapping.access_kind = "partner_control"; },
    (s) => { s.mapping.digital_observer_partner_customers.partner_id = id(9); },
    (s) => { s.mapping.digital_observer_partner_customers.digital_observer_partners.organization_id = id(9); },
    (s) => { s.mapping.digital_observer_partner_customers.customer_status = "suspended"; },
    (s) => { s.account.account_status = "revoked"; },
    (s) => { s.site.digital_observer_organization_id = id(9); },
    (s) => { s.site.garden_id = id(8); },
    (s) => { s.customerSiteLink = null; }
  ]) {
    const f = make(); change(f.state);
    assert.equal(await authorizePartnerDelegatedSite(f.admin, { serviceAccountId: base.serviceAccountId, siteId: id(7) }), false);
    noWrites(f);
  }
});

test("unique insert race accepts only an identical winning mapping", async () => {
  for (const winner of [desired(customerId), { ...desired(customerId), partner_customer_id: id(10) }]) {
    const f = fixture(); f.state.fail = "insert-race"; f.state.raceMapping = winner;
    if (winner.partner_customer_id === customerId) assert.deepEqual(await link(f, { customerId }), winner);
    else await assert.rejects(() => link(f, { customerId }), /PARTNER_SERVICE_ACCOUNT_CONFLICT/);
    assert.deepEqual(f.state.mapping, winner);
    assert.equal(f.state.calls.insertAttempts, 1);
    assert.equal(f.state.calls.ownMappingWrites, 0);
    assert.equal(f.state.calls.audits, 0);
  }
});
