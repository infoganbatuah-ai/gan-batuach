import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// Runs the real service functions against synthetic query responses only.
// No Supabase connection, SQL execution, provider traffic, or real identity.
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
const { issuePartnerEmbeddedSession, authenticateEmbeddedSession } = await import("../../lib/domain/digital-observer/partner-platform-service.ts");
const route = readFileSync(new URL("../../app/api/digital-observer/embed/v1/dashboard/route.ts", import.meta.url), "utf8");
const ids = { partner: "partner", partnerOrg: "partner-org", customer: "customer", customerOrg: "customer-org", site: "site" };
const issueInput = { partnerId: ids.partner, organizationId: ids.partnerOrg, actorId: "actor", actorRole: "organization_admin",
  customerId: ids.customer, siteId: ids.site, audience: "synthetic-partner-app", origin: "https://partner.test",
  scopes: ["cameras.read"], ttlMinutes: 15, correlationId: "synthetic-correlation" };
const authInput = (token, overrides = {}) => ({ token, origin: "https://partner.test", audience: "synthetic-partner-app",
  requiredScope: "cameras.read", ...overrides });

function fixture() {
  const state = {
    partner: { id: ids.partner, organization_id: ids.partnerOrg, partner_status: "sandbox", allowed_embed_origins: ["https://partner.test"] },
    customer: { id: ids.customer, partner_id: ids.partner, customer_organization_id: ids.customerOrg, customer_status: "active" },
    site: { id: ids.site, digital_observer_organization_id: ids.customerOrg, site_type: "home", garden_id: null },
    link: { partner_customer_id: ids.customer, observer_site_id: ids.site },
    organizations: [{ id: ids.partnerOrg, status: "active" }, { id: ids.customerOrg, status: "active" }],
    sessions: [], failedTable: null, failTouch: false,
    calls: { issued: 0, touched: 0, audited: 0 }
  };
  const admin = { from(table) {
    const filters = new Map(); const exclusions = new Map(); const inclusions = new Map(); const greater = new Map();
    let operation = "read"; let payload; let max = Infinity;
    const query = {
      select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      is(key, value) { filters.set(key, value); return this; }, neq(key, value) { exclusions.set(key, value); return this; },
      in(key, values) { inclusions.set(key, values); return this; }, limit(value) { max = value; return this; },
      gt(key, value) { greater.set(key, value); return this; },
      insert(value) { operation = "insert"; payload = value; return this; },
      update(value) { operation = "update"; payload = value; return this; },
      maybeSingle() { return Promise.resolve(this.result(true)); }, single() { return Promise.resolve(this.result(true)); },
      then(resolve, reject) { return Promise.resolve(this.result(false)).then(resolve, reject); },
      result(single) {
        if (state.failedTable === table) return { data: null, error: { code: "synthetic-failure" } };
        if (table === "digital_observer_enterprise_audit_events") {
          assert.equal(operation, "insert"); state.calls.audited++; return { data: null, error: null };
        }
        if (table === "digital_observer_embedded_sessions" && operation === "insert") {
          const row = { ...payload, id: `session-${state.sessions.length + 1}`, revoked_at: null, last_used_at: null };
          state.sessions.push(row); state.calls.issued++; return { data: row, error: null };
        }
        const sources = {
          digital_observer_partners: state.partner ? [state.partner] : [],
          digital_observer_partner_customers: state.customer ? [state.customer] : [],
          observer_sites: state.site ? [state.site] : [],
          digital_observer_partner_customer_sites: state.link ? [state.link] : [],
          digital_observer_organizations: state.organizations,
          digital_observer_embedded_sessions: state.sessions
        };
        assert.ok(table in sources, `unexpected table: ${table}`);
        const rows = sources[table].filter((row) => [...filters].every(([key, value]) => row[key] === value)
          && [...exclusions].every(([key, value]) => row[key] !== value && row[key] !== null)
          && [...inclusions].every(([key, values]) => values.includes(row[key]))
          && [...greater].every(([key, value]) => new Date(row[key]).getTime() > new Date(value).getTime())).slice(0, max);
        if (operation === "update") {
          if (state.failTouch) return { data: null, error: { code: "synthetic-touch-failure" } };
          if (!rows.length) return { data: null, error: { code: "PGRST116" } };
          Object.assign(rows[0], payload); state.calls.touched++;
          return { data: rows[0], error: null };
        }
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
    };
    return query;
  } };
  return { admin, state };
}

async function issue(f) { return issuePartnerEmbeddedSession(f.admin, issueInput); }
async function auth(f, token, overrides) { return authenticateEmbeddedSession(f.admin, authInput(token, overrides)); }
function noWrites(f) { assert.deepEqual(f.state.calls, { issued: 0, touched: 0, audited: 0 }); }

test("valid current ownership issues a token and authenticates with a recorded use", async () => {
  const f = fixture(); const issued = await issue(f);
  assert.equal(issued.session.observer_site_id, ids.site);
  assert.equal(f.state.calls.issued, 1); assert.equal(f.state.calls.audited, 1);
  const row = await auth(f, issued.token);
  assert.equal(row.id, issued.session.id); assert.equal(f.state.calls.touched, 1);
  assert.ok(f.state.sessions[0].last_used_at);
  assert.ok(!JSON.stringify(f.state.sessions).includes(issued.token));
});

test("issuance rejects foreign, kindergarten, garden, inactive, and mismatched ownership before writing", async () => {
  for (const [name, mutate] of [
    ["foreign linked Site", (s) => { s.site.digital_observer_organization_id = "foreign-org"; }],
    ["kindergarten", (s) => { s.site.site_type = "kindergarten"; }],
    ["garden", (s) => { s.site.garden_id = "garden"; }],
    ["inactive customer organization", (s) => { s.organizations[1].status = "suspended"; }],
    ["inactive partner organization", (s) => { s.organizations[0].status = "suspended"; }],
    ["self-owned customer", (s) => { s.customer.customer_organization_id = ids.partnerOrg; }],
    ["other partner", (s) => { s.customer.partner_id = "other-partner"; }],
    ["suspended partner", (s) => { s.partner.partner_status = "suspended"; }],
    ["suspended customer", (s) => { s.customer.customer_status = "suspended"; }],
    ["missing link", (s) => { s.link = null; }],
    ["lookup failure", (s) => { s.failedTable = "observer_sites"; }]
  ]) {
    const f = fixture(); mutate(f.state);
    await assert.rejects(() => issue(f), /PARTNER_EMBED_SCOPE_DENIED/, name);
    noWrites(f);
  }
});

test("malformed or unapproved issuance origin cannot create a session", async () => {
  for (const origin of ["not-a-url", "https://foreign.test", "https://partner.test/path"]) {
    const f = fixture();
    await assert.rejects(() => issuePartnerEmbeddedSession(f.admin, { ...issueInput, origin }), /PARTNER_EMBED_ORIGIN_DENIED/);
    noWrites(f);
  }
});

test("an issued token loses access when current ownership, Site link, or origin allowlist changes", async () => {
  for (const [name, mutate] of [
    ["link removed", (s) => { s.link = null; }],
    ["Site transferred", (s) => { s.site.digital_observer_organization_id = "foreign-org"; }],
    ["Site becomes kindergarten", (s) => { s.site.site_type = "kindergarten"; }],
    ["Site gains garden", (s) => { s.site.garden_id = "garden"; }],
    ["customer suspended", (s) => { s.customer.customer_status = "suspended"; }],
    ["partner suspended", (s) => { s.partner.partner_status = "suspended"; }],
    ["customer organization suspended", (s) => { s.organizations[1].status = "suspended"; }],
    ["origin removed", (s) => { s.partner.allowed_embed_origins = []; }],
    ["session customer changed", (s) => { s.sessions[0].partner_customer_id = "other-customer"; }],
    ["session partner changed", (s) => { s.sessions[0].partner_id = "other-partner"; }],
    ["session Site changed", (s) => { s.sessions[0].observer_site_id = "other-site"; }],
    ["link changed to another customer", (s) => { s.link.partner_customer_id = "other-customer"; }],
    ["scope lookup failed", (s) => { s.failedTable = "digital_observer_partner_customer_sites"; }]
  ]) {
    const f = fixture(); const issued = await issue(f); mutate(f.state);
    await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/, name);
    assert.equal(f.state.calls.touched, 0, name);
  }
});

test("bad token, expiry, revocation, audience, origin and scope deny without use accounting", async () => {
  const f = fixture(); const issued = await issue(f);
  for (const [token, overrides, expected] of [
    ["invalid", {}, /EMBEDDED_AUTH_REQUIRED/],
    ["doemb_wrong", {}, /EMBEDDED_SESSION_INACTIVE/],
    [issued.token, { audience: "wrong-app" }, /EMBEDDED_AUDIENCE_DENIED/],
    [issued.token, { origin: "not-a-url" }, /EMBEDDED_ORIGIN_DENIED/],
    [issued.token, { origin: 42 }, /EMBEDDED_ORIGIN_DENIED/],
    [issued.token, { origin: "https://partner.test/other" }, /EMBEDDED_ORIGIN_DENIED/],
    [issued.token, { origin: null }, /EMBEDDED_ORIGIN_DENIED/],
    [issued.token, { requiredScope: "events.read" }, /EMBEDDED_SCOPE_DENIED/]
  ]) await assert.rejects(() => auth(f, token, overrides), expected);
  f.state.sessions[0].revoked_at = new Date().toISOString();
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
  f.state.sessions[0].revoked_at = null;
  f.state.sessions[0].expires_at = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
  assert.equal(f.state.calls.touched, 0);
});

test("failed or raced last-used write never reports authenticated success", async () => {
  for (const mode of ["error", "revoked-before-touch"]) {
    const f = fixture(); const issued = await issue(f);
    if (mode === "error") f.state.failTouch = true;
    else {
      const originalFrom = f.admin.from;
      f.admin.from = (table) => {
        const query = originalFrom(table);
        if (table === "digital_observer_embedded_sessions") {
          const originalUpdate = query.update;
          query.update = (value) => { f.state.sessions[0].revoked_at = new Date().toISOString(); return originalUpdate.call(query, value); };
        }
        return query;
      };
    }
    await assert.rejects(() => auth(f, issued.token), /EMBEDDED_SESSION_INACTIVE/);
    assert.equal(f.state.calls.touched, 0);
  }
});

test("dashboard route authenticates before any Product reads and never includes raw media", () => {
  assert.ok(route.indexOf("await authenticateEmbeddedSession") < route.indexOf("digital_observer_camera_sources"));
  assert.ok(route.includes("raw_video_embedded: false"));
  assert.ok(route.includes('"cache-control": "no-store"'));
});
