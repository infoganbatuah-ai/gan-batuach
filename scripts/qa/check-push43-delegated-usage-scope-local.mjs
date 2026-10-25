import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Source-contract and synthetic-domain checks only. This script never starts
// PostgreSQL or runs the migration/RPC; database behavior remains unproven.
const oldPath = new URL("../../supabase/migrations/20261019041000_digital_observer_push43_delegated_usage.sql", import.meta.url);
const newPath = new URL("../../supabase/migrations/20261025224109_digital_observer_push43_delegated_usage_scope.sql", import.meta.url);
const oldSql = readFileSync(oldPath, "utf8");
const sql = readFileSync(newPath, "utf8");
const ledger = JSON.parse(readFileSync(new URL("../../DEVELOPMENT_MIGRATION_LEDGER.json", import.meta.url), "utf8"));

function fixture() {
  return {
    caller: "service_role", now: 100,
    account: { id: "service", organizationId: "partner-org", status: "active", revokedAt: null, expiresAt: 200 },
    site: { id: "site", organizationId: "customer-org", siteType: "home", gardenId: null },
    mapping: { serviceAccountId: "service", partnerId: "partner", customerId: "customer", accessKind: "customer_resources" },
    partner: { id: "partner", organizationId: "partner-org", status: "sandbox" },
    partnerOrganization: { id: "partner-org", status: "active" },
    customer: { id: "customer", partnerId: "partner", organizationId: "customer-org", status: "active" },
    customerOrganization: { id: "customer-org", status: "active" },
    link: { customerId: "customer", siteId: "site" }
  };
}

function syntheticContractAllows(f) {
  const { account: a, site: s, mapping: m, partner: p, partnerOrganization: po,
    customer: c, customerOrganization: co, link: l } = f;
  if (f.caller !== "service_role" || !a || !s || a.id !== "service" || s.id !== "site"
    || a.status !== "active" || a.revokedAt !== null || !(a.expiresAt > f.now)) return false;
  if (s.organizationId === a.organizationId) return true; // Existing direct PUSH 42 path.
  return Boolean(m && p && po && c && co && l
    && m.serviceAccountId === a.id && m.accessKind === "customer_resources"
    && m.partnerId === p.id && p.organizationId === a.organizationId && p.status === "sandbox"
    && po.id === p.organizationId && po.status === "active"
    && m.customerId === c.id && c.partnerId === p.id && c.status === "active"
    && co.id === c.organizationId && co.status === "active"
    && c.organizationId !== p.organizationId && s.organizationId === c.organizationId
    && s.gardenId === null && s.siteType !== "kindergarten"
    && l.customerId === c.id && l.siteId === s.id);
}

test("applied PUSH 43 migration is preserved byte-for-byte", () => {
  const entries = Array.isArray(ledger) ? ledger : Object.values(ledger).flatMap((value) => Array.isArray(value) ? value : []);
  const entry = entries.find((row) => row.file === "supabase/migrations/20261019041000_digital_observer_push43_delegated_usage.sql");
  assert.equal(entry?.developmentApplied, "YES");
  assert.equal(createHash("sha256").update(oldSql).digest("hex"), entry.sha256);
});

test("forward migration keeps the exact RPC signature, privileged boundary and usage write", () => {
  const signature = "public.record_digital_observer_external_api_usage(\n  requested_service_account_id uuid,\n  requested_site_id uuid,\n  requested_operation text,\n  requested_bucket_start timestamptz,\n  requested_success boolean\n) returns uuid";
  assert.ok(sql.includes(signature));
  assert.ok(sql.includes("security definer set search_path='' set row_security=off"));
  assert.ok(sql.includes("auth.role() is distinct from 'service_role'"));
  assert.ok(sql.includes("revoke all on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) from public, anon, authenticated;"));
  assert.ok(sql.includes("grant execute on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) to service_role;"));
  const write = (source) => source.slice(source.indexOf("  insert into public.digital_observer_external_api_usage_buckets("), source.indexOf("  return result_id;"));
  assert.notEqual(write(sql), "");
  assert.equal(write(sql), write(oldSql)); // No change to bucket count, upsert, or retention behavior.
  assert.ok(sql.includes("s.digital_observer_organization_id=a.organization_id"));
  assert.ok(!/\b(create table|alter table|drop table|truncate)\b/i.test(sql));
});

test("delegated source predicate binds every ownership and commercial-Site edge", () => {
  for (const predicate of [
    "a.account_status='active'", "a.revoked_at is null", "a.expires_at>now()",
    "psa.service_account_id=a.id", "psa.access_kind='customer_resources'",
    "p.id=psa.partner_id", "p.organization_id=a.organization_id", "p.partner_status='sandbox'",
    "partner_org.id=p.organization_id and partner_org.status='active'",
    "pc.id=psa.partner_customer_id", "pc.partner_id=p.id", "pc.customer_status='active'",
    "customer_org.id=pc.customer_organization_id", "customer_org.status='active'",
    "pcs.partner_customer_id=pc.id and pcs.observer_site_id=s.id",
    "pc.customer_organization_id<>p.organization_id",
    "s.digital_observer_organization_id=pc.customer_organization_id",
    "s.garden_id is null", "s.site_type<>'kindergarten'"
  ]) assert.ok(sql.includes(predicate), `missing SQL predicate: ${predicate}`);
});

test("synthetic direct owner remains valid, foreign direct owner is denied", () => {
  const direct = fixture(); direct.site.organizationId = direct.account.organizationId;
  direct.mapping = null;
  assert.equal(syntheticContractAllows(direct), true);
  direct.site.organizationId = "foreign-org";
  assert.equal(syntheticContractAllows(direct), false);
});

test("synthetic valid delegated chain and each foreign or suspended edge", () => {
  assert.equal(syntheticContractAllows(fixture()), true);
  const cases = [
    ["foreign linked Site", (f) => { f.site.organizationId = "foreign-org"; }],
    ["suspended service account", (f) => { f.account.status = "suspended"; }],
    ["revoked service account", (f) => { f.account.revokedAt = 90; }],
    ["expired service account", (f) => { f.account.expiresAt = 99; }],
    ["foreign service-account organization", (f) => { f.account.organizationId = "foreign-org"; }],
    ["suspended partner", (f) => { f.partner.status = "suspended"; }],
    ["foreign partner organization", (f) => { f.partner.organizationId = "foreign-org"; }],
    ["inactive partner organization", (f) => { f.partnerOrganization.status = "suspended"; }],
    ["suspended customer", (f) => { f.customer.status = "suspended"; }],
    ["foreign customer partner", (f) => { f.customer.partnerId = "foreign-partner"; }],
    ["inactive customer organization", (f) => { f.customerOrganization.status = "suspended"; }],
    ["customer organization mismatch", (f) => { f.customer.organizationId = "foreign-org"; }],
    ["self-delegation", (f) => { f.customer.organizationId = f.partner.organizationId; }],
    ["kindergarten Site", (f) => { f.site.siteType = "kindergarten"; }],
    ["Site with garden", (f) => { f.site.gardenId = "garden"; }],
    ["wrong linked Site", (f) => { f.link.siteId = "other-site"; }],
    ["wrong linked customer", (f) => { f.link.customerId = "other-customer"; }],
    ["partner-control mapping", (f) => { f.mapping.accessKind = "partner_control"; }],
    ["anonymous caller", (f) => { f.caller = "anon"; }]
  ];
  for (const [name, mutate] of cases) {
    const f = fixture(); mutate(f);
    assert.equal(syntheticContractAllows(f), false, name);
  }
});
