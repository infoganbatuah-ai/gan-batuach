import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// Real service code, synthetic query adapter. No database, SQL, or provider connection.
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

const { savePartnerBrand } = await import("../../lib/domain/digital-observer/partner-platform-service.ts");
const input = { partnerId: "partner", organizationId: "partner-org", actorId: "actor", actorRole: "organization_admin",
  correlationId: "synthetic", brand: { brand_name: "Partner", product_name: "Observer", primary_color: "#123456",
    accent_color: "#abcdef", privacy_url: "https://partner.test/privacy", terms_url: "https://partner.test/terms",
    legally_required_notices: ["synthetic notice"], customer_domain: "partner.test" } };

function fixture() {
  const state = { partner: { id: input.partnerId, organization_id: input.organizationId, partner_status: "sandbox" },
    organization: { id: input.organizationId, status: "active" },
    brand: null, partnerReadError: false, brandReadError: false, brandWriteError: false, auditError: false,
    racePartnerAtRead: 0, raceUpdatedAt: false, partnerReads: 0, writes: { brand: 0, audit: 0 } };
  const admin = { from(table) {
    const filters = new Map(); let operation = "read"; let payload;
    const query = {
      select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      insert(value) { operation = "insert"; payload = value; return this; },
      update(value) { operation = "update"; payload = value; return this; },
      maybeSingle() { return Promise.resolve(this.result()); }, single() { return Promise.resolve(this.result()); },
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); },
      result() {
        if (table === "digital_observer_enterprise_audit_events") {
          assert.equal(operation, "insert"); state.writes.audit++;
          return { data: null, error: state.auditError ? { code: "synthetic" } : null };
        }
        if (table === "digital_observer_partners") {
          state.partnerReads++;
          if (state.partnerReadError) return { data: null, error: { code: "synthetic" } };
          if (state.partnerReads === state.racePartnerAtRead && state.partner) state.partner.partner_status = "suspended";
          const row = state.partner;
          return { data: row && [...filters].every(([key, value]) => row[key] === value) ? row : null, error: null };
        }
        if (table === "digital_observer_organizations") {
          const row = state.organization;
          return { data: row && [...filters].every(([key, value]) => row[key] === value) ? row : null, error: null };
        }
        assert.equal(table, "digital_observer_partner_brand_profiles");
        if (operation === "read" && state.brandReadError) return { data: null, error: { code: "synthetic" } };
        if (operation !== "read" && state.brandWriteError) return { data: null, error: { code: "synthetic" } };
        if (operation === "update" && state.raceUpdatedAt && state.brand) state.brand.updated_at = "2099-01-01T00:00:00.000Z";
        const row = state.brand;
        const matches = row && [...filters].every(([key, value]) => row[key] === value);
        if (operation === "read") return { data: matches ? row : null, error: null };
        if (operation === "insert") {
          if (row) return { data: null, error: { code: "23505" } };
          state.brand = { ...payload }; state.writes.brand++;
          return { data: state.brand, error: null };
        }
        if (!matches) return { data: null, error: { code: "PGRST116" } };
        Object.assign(row, payload); state.writes.brand++;
        return { data: row, error: null };
      }
    };
    return query;
  } };
  return { admin, state };
}
const save = (f, overrides = {}) => savePartnerBrand(f.admin, { ...input, ...overrides });
const noWrites = (f) => assert.deepEqual(f.state.writes, { brand: 0, audit: 0 });

test("owned sandbox partner can create a safe public brand", async () => {
  const f = fixture(); const result = await save(f);
  assert.equal(result.brand_name, "Partner"); assert.equal(result.domain_status, "unverified");
  assert.equal(result.partner_id, undefined); assert.equal(result.updated_by, undefined);
  assert.equal(result.platform_brand_exposed, false);
  assert.deepEqual(f.state.writes, { brand: 1, audit: 1 });
});

test("foreign, missing, suspended, and lookup-failed partners cannot write brand", async () => {
  for (const mutate of [
    (s) => { s.partner.organization_id = "foreign-org"; },
    (s) => { s.partner = null; },
    (s) => { s.partner.partner_status = "suspended"; },
    (s) => { s.organization.status = "suspended"; },
    (s) => { s.partnerReadError = true; },
    (s) => { s.brandReadError = true; },
    (s) => { s.racePartnerAtRead = 2; }
  ]) {
    const f = fixture(); mutate(f.state);
    await assert.rejects(() => save(f), /PARTNER_BRAND_(SCOPE_DENIED|PARTNER_LOOKUP_FAILED|LOOKUP_FAILED)/);
    noWrites(f);
  }
});

test("direct service invocation cannot inject partner ID or verified status into brand", async () => {
  for (const injected of [{ partner_id: "foreign-partner" }, { domain_status: "verified_sandbox" }]) {
    const f = fixture();
    await assert.rejects(() => save(f, { brand: { ...input.brand, ...injected } }));
    noWrites(f);
  }
});

test("unprivileged actor cannot save a brand", async () => {
  const f = fixture();
  await assert.rejects(() => save(f, { actorRole: "viewer" }), /PARTNER_MANAGEMENT_DENIED/);
  noWrites(f);
});

test("same domain retains verified status; domain change invalidates it", async () => {
  const f = fixture(); f.state.brand = { partner_id: input.partnerId, customer_domain: "partner.test",
    domain_status: "verified_sandbox", updated_at: "2026-10-01T00:00:00.000Z", brand_name: "Old" };
  const same = await save(f);
  assert.equal(same.domain_status, "verified_sandbox"); assert.equal(f.state.writes.audit, 1);
  const changed = await save(f, { brand: { ...input.brand, customer_domain: "new.partner.test" } });
  assert.equal(changed.domain_status, "unverified"); assert.equal(f.state.writes.brand, 2);
});

test("stale brand timestamp, failed write, and failed audit never report success", async () => {
  for (const failure of ["raceUpdatedAt", "brandWriteError"]) {
    const f = fixture(); f.state.brand = { partner_id: input.partnerId, customer_domain: "partner.test",
      domain_status: "unverified", updated_at: "2026-10-01T00:00:00.000Z" };
    f.state[failure] = true;
    await assert.rejects(() => save(f), /PARTNER_BRAND_SAVE_FAILED/);
    noWrites(f);
  }
  const f = fixture(); f.state.auditError = true;
  await assert.rejects(() => save(f), /PARTNER_AUDIT_FAILED/);
  assert.deepEqual(f.state.writes, { brand: 1, audit: 1 });
});

test("partner changed after write is detected, but requires PostgreSQL atomic gate", async () => {
  const f = fixture(); f.state.racePartnerAtRead = 3;
  await assert.rejects(() => save(f), /PARTNER_BRAND_SCOPE_DENIED/);
  assert.deepEqual(f.state.writes, { brand: 1, audit: 0 });
});

test("route resolves the enterprise actor before dispatching save_brand", () => {
  const route = readFileSync(new URL("../../app/api/digital-observer/partners/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("await resolveEnterpriseActor") < route.indexOf('input.action === "save_brand"'));
});
