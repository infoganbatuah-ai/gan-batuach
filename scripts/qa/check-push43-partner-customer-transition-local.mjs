import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// Synthetic query adapter only: no database, SQL, provider traffic, or real identities.
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

process.env.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER = randomBytes(32).toString("hex");
const { transitionPartnerCustomer, issuePartnerEmbeddedSession, authenticateEmbeddedSession } = await import("../../lib/domain/digital-observer/partner-platform-service.ts");
const ids = { partner: "partner", partnerOrg: "partner-org", customer: "customer", customerOrg: "customer-org", site: "site" };
const transitionInput = (status) => ({ partnerId: ids.partner, organizationId: ids.partnerOrg, actorId: "actor",
  actorRole: "organization_admin", customerId: ids.customer, status, reason: "synthetic qualification", correlationId: "synthetic" });
const issueInput = { partnerId: ids.partner, organizationId: ids.partnerOrg, actorId: "actor", actorRole: "organization_admin",
  customerId: ids.customer, siteId: ids.site, audience: "test-app", origin: "https://partner.test",
  scopes: ["cameras.read"], ttlMinutes: 15, correlationId: "synthetic" };

function fixture() {
  const state = {
    partner: { id: ids.partner, organization_id: ids.partnerOrg, partner_status: "sandbox", allowed_embed_origins: ["https://partner.test"] },
    customer: { id: ids.customer, partner_id: ids.partner, customer_organization_id: ids.customerOrg,
      customer_status: "active", activated_at: new Date(Date.now() - 60_000).toISOString() },
    organizations: [{ id: ids.partnerOrg, status: "active" }, { id: ids.customerOrg, status: "active" }],
    site: { id: ids.site, digital_observer_organization_id: ids.customerOrg, site_type: "home", garden_id: null },
    link: { partner_customer_id: ids.customer, observer_site_id: ids.site },
    sessions: [], failRevocation: false, raceStatus: null, beforeSessionInsert: null,
    writes: { customer: 0, revoked: 0, audit: 0 }
  };
  const admin = { from(table) {
    const eq = new Map(); const is = new Map(); const ne = new Map(); const ins = new Map(); const gt = new Map();
    let operation = "read"; let payload; let limit = Infinity;
    const query = {
      select() { return this; }, eq(k, v) { eq.set(k, v); return this; }, is(k, v) { is.set(k, v); return this; },
      neq(k, v) { ne.set(k, v); return this; }, in(k, v) { ins.set(k, v); return this; },
      gt(k, v) { gt.set(k, v); return this; }, limit(v) { limit = v; return this; },
      update(v) { operation = "update"; payload = v; return this; }, insert(v) { operation = "insert"; payload = v; return this; },
      maybeSingle() { return Promise.resolve(this.result(true)); }, single() { return Promise.resolve(this.result(true)); },
      then(resolve, reject) { return Promise.resolve(this.result(false)).then(resolve, reject); },
      result(single) {
        if (table === "digital_observer_enterprise_audit_events") {
          assert.equal(operation, "insert"); state.writes.audit++; return { data: null, error: null };
        }
        if (table === "digital_observer_embedded_sessions" && operation === "insert") {
          state.beforeSessionInsert?.();
          const row = { ...payload, id: `session-${state.sessions.length + 1}`, created_at: new Date().toISOString(), revoked_at: null };
          state.sessions.push(row); return { data: row, error: null };
        }
        const sources = { digital_observer_partners: state.partner ? [state.partner] : [],
          digital_observer_partner_customers: state.customer ? [state.customer] : [],
          digital_observer_organizations: state.organizations, observer_sites: [state.site],
          digital_observer_partner_customer_sites: [state.link], digital_observer_embedded_sessions: state.sessions };
        assert.ok(table in sources, `unexpected table ${table}`);
        if (operation === "update" && table === "digital_observer_partner_customers" && state.raceStatus) {
          state.customer.customer_status = state.raceStatus; state.raceStatus = null;
        }
        const rows = sources[table].filter((row) => [...eq].every(([k, v]) => row[k] === v)
          && [...is].every(([k, v]) => row[k] === v) && [...ne].every(([k, v]) => row[k] !== v && row[k] !== null)
          && [...ins].every(([k, v]) => v.includes(row[k]))
          && [...gt].every(([k, v]) => new Date(row[k]).getTime() > new Date(v).getTime())).slice(0, limit);
        if (operation === "update") {
          if (table === "digital_observer_embedded_sessions" && state.failRevocation) return { data: null, error: { code: "synthetic" } };
          if (single && !rows.length) return { data: null, error: { code: "PGRST116" } };
          for (const row of rows) Object.assign(row, payload);
          if (table === "digital_observer_partner_customers") state.writes.customer += rows.length;
          if (table === "digital_observer_embedded_sessions" && "revoked_at" in payload) state.writes.revoked += rows.length;
        }
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
    };
    return query;
  } };
  return { admin, state };
}
async function transition(f, status, overrides = {}) { return transitionPartnerCustomer(f.admin, { ...transitionInput(status), ...overrides }); }
async function issue(f) { return issuePartnerEmbeddedSession(f.admin, issueInput); }
async function auth(f, token) { return authenticateEmbeddedSession(f.admin, { token, origin: issueInput.origin,
  audience: issueInput.audience, requiredScope: "cameras.read" }); }

test("foreign or missing partner/customer and inactive organization deny before writes", async () => {
  for (const mutate of [
    (s) => { s.partner.organization_id = "foreign-org"; },
    (s) => { s.partner = null; },
    (s) => { s.customer = null; },
    (s) => { s.customer.partner_id = "foreign-partner"; },
    (s) => { s.customer.customer_organization_id = ids.partnerOrg; },
    (s) => { s.organizations[1].status = "suspended"; }
  ]) {
    const f = fixture(); mutate(f.state);
    await assert.rejects(() => transition(f, "suspended"), /PARTNER_CUSTOMER_SCOPE_DENIED/);
    assert.deepEqual(f.state.writes, { customer: 0, revoked: 0, audit: 0 });
  }
});

test("valid transition uses status CAS and revokes old embedded sessions", async () => {
  const f = fixture(); const issued = await issue(f);
  assert.equal((await transition(f, "suspended")).customer_status, "suspended");
  assert.equal(f.state.writes.customer, 1); assert.equal(f.state.writes.revoked, 1);
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
});

test("CAS zero rows rejects stale transition without revocation or audit", async () => {
  const f = fixture(); f.state.raceStatus = "suspended";
  await assert.rejects(() => transition(f, "deprovisioned"), /PARTNER_CUSTOMER_TRANSITION_FAILED/);
  assert.deepEqual(f.state.writes, { customer: 0, revoked: 0, audit: 0 });
});

test("revocation failure leaves customer inactive; repeat repairs without status rewrite", async () => {
  const f = fixture(); const issued = await issue(f); f.state.failRevocation = true;
  await assert.rejects(() => transition(f, "suspended"), /PARTNER_EMBED_REVOCATION_FAILED/);
  assert.equal(f.state.customer.customer_status, "suspended");
  assert.equal(f.state.sessions[0].revoked_at, null);
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
  f.state.failRevocation = false;
  await transition(f, "suspended");
  assert.equal(f.state.writes.customer, 1); assert.equal(f.state.writes.revoked, 1);
  const auditCount = f.state.writes.audit;
  await transition(f, "suspended");
  assert.equal(f.state.writes.customer, 1); assert.equal(f.state.writes.revoked, 1);
  assert.equal(f.state.writes.audit, auditCount);
});

test("reactivation after failed revocation cannot revive old token", async () => {
  const f = fixture(); const issued = await issue(f); f.state.failRevocation = true;
  await assert.rejects(() => transition(f, "suspended"), /PARTNER_EMBED_REVOCATION_FAILED/);
  f.state.failRevocation = false;
  await transition(f, "active");
  assert.equal(f.state.sessions[0].revoked_at, null);
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
  const replacement = await issue(f);
  assert.equal((await auth(f, replacement.token)).id, replacement.session.id);
});

test("legacy tokens without activation binding and raced issuance fail closed", async () => {
  const f = fixture(); const issued = await issue(f);
  delete f.state.sessions[0].metadata.customer_activation_epoch_ms;
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
  f.state.beforeSessionInsert = () => {
    f.state.customer.activated_at = new Date(Date.now() + 1_000).toISOString();
  };
  const raced = await issue(f);
  await assert.rejects(() => auth(f, raced.token), /EMBEDDED_SESSION_INACTIVE/);
});

test("invalid activation marker and same-status active repeat fail closed", async () => {
  const f = fixture(); const issued = await issue(f);
  f.state.customer.activated_at = null;
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
  await assert.rejects(() => transition(f, "active"), /PARTNER_CUSTOMER_TRANSITION_DENIED/);
  assert.equal(f.state.writes.customer, 0);
});
