import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { DigitalObserverEmbeddedClient } = loadTs("packages/digital-observer-sdk/src/browser.ts");
const { hashEmbeddedToken } = loadTs("lib/domain/digital-observer/partner-platform.ts");
const endpoint = "https://observer.example.invalid/api/digital-observer/embed/v1/dashboard";
const allowedOrigin = "https://partner.example.invalid";
const audience = "synthetic-partner-dashboard";
const token = "doemb_synthetic_only";
const pepper = "synthetic-local-pepper";
const sessionTable = "digital_observer_embedded_sessions";
const linkTable = "digital_observer_partner_customer_sites";
const camerasTable = "digital_observer_camera_sources";

function fixture() {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const session = {
    id: "session", partner_id: "partner", partner_customer_id: "customer", observer_site_id: "site",
    token_hash: hashEmbeddedToken(token, pepper), allowed_origin: allowedOrigin, audience, scopes: ["cameras.read"],
    expires_at: expiresAt, revoked_at: null,
    digital_observer_partner_customers: { partner_id: "partner", customer_status: "active", customer_organization_id: "tenant" },
    digital_observer_partners: { partner_status: "sandbox", allowed_embed_origins: [allowedOrigin] },
  };
  const state = { session, linked: true, siteOrg: "tenant", reads: [], duringCameraRead: () => {}, confirmError: false };
  function rows(table) {
    switch (table) {
      case sessionTable: return [session];
      case linkTable: return state.linked ? [{ partner_customer_id: "customer", observer_site_id: "site" }] : [
        { partner_customer_id: "another-customer", observer_site_id: "site" },
        { partner_customer_id: "customer", observer_site_id: "another-site" },
      ];
      case "observer_sites": return [
        { id: "site", digital_observer_organization_id: state.siteOrg, garden_id: null, site_type: "home" },
        { id: "another-site", digital_observer_organization_id: "tenant", garden_id: null, site_type: "home" },
      ];
      case "digital_observer_partner_brand_profiles": return [];
      case camerasTable:
        state.duringCameraRead();
        return [
          { id: "expected-camera", observer_site_id: "site", source_mode: "demo" },
          { id: "other-camera", observer_site_id: "another-site", source_mode: "demo" },
        ];
      default: assert.fail(`Unexpected table: ${table}`);
    }
  }
  const admin = {
    from(table) {
      state.reads.push(table);
      const filters = [];
      let values;
      function result(single) {
        if (values && state.confirmError) return { data: null, error: { code: "fixture_error" } };
        const selected = rows(table).filter((row) => filters.every((matches) => matches(row)));
        if (values) selected.forEach((row) => Object.assign(row, values));
        return { data: single ? selected[0] ?? null : selected, error: null };
      }
      return {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { return this.eq(key, value); },
        neq(key, value) { filters.push((row) => row[key] !== value); return this; },
        gt(key, value) { filters.push((row) => row[key] > value); return this; },
        order() { return this; },
        limit() { return this; },
        update(data) { values = data; return this; },
        async maybeSingle() { return result(true); },
        then(resolve) { return Promise.resolve(result(false)).then(resolve); },
      };
    },
  };
  const { GET, OPTIONS } = loadTs("app/api/digital-observer/embed/v1/dashboard/route.ts", {
    process: { env: { DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER: pepper } },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/admin": { createAdminClient: () => admin, isAdminClientConfigured: () => true },
  });
  return {
    state,
    preflight(origin = allowedOrigin, method = "GET", headers = "authorization,x-do-audience") {
      return OPTIONS(new Request(endpoint, { method: "OPTIONS", headers: {
        origin, "access-control-request-method": method, "access-control-request-headers": headers,
      } }));
    },
    dashboard(origin = allowedOrigin, sdkAudience = audience, sdkToken = token) {
      return new DigitalObserverEmbeddedClient({ endpoint, token: sdkToken, audience: sdkAudience, fetch: async (url, init) => {
        assert.equal(init.credentials, "omit");
        const headers = new Headers(init.headers);
        if (origin !== null) headers.set("origin", origin);
        const response = await GET(new Request(url, { ...init, headers }));
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("access-control-allow-origin"), response.ok ? allowedOrigin : null);
        assert.equal(response.headers.get("access-control-allow-credentials"), null);
        return response;
      } }).dashboard();
    },
  };
}

test("browser SDK preflights only the bounded read and receives a minimized, authorized dashboard", async () => {
  const { dashboard, preflight, state } = fixture();
  const response = preflight();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-methods"), "GET");
  assert.equal(response.headers.get("access-control-allow-headers"), "Authorization, X-DO-Audience");
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
  assert.equal(preflight(allowedOrigin, "POST").status, 403);
  assert.equal(preflight(allowedOrigin, "GET", "authorization,x-unknown").status, 403);
  assert.equal(preflight(`${allowedOrigin}/path`).status, 403);
  assert.deepEqual(state.reads, []);
  const result = await dashboard();
  assert.equal(result.site.id, "site");
  assert.deepEqual(result.cameras.map(({ id }) => id), ["expected-camera"]);
  assert.deepEqual([result.camera_health, result.events, result.incidents, result.evidence_references], [[], [], [], []]);
  assert.equal(result.raw_video_embedded, false);
  assert.equal(result.production_proof, false);
  assert.doesNotMatch(JSON.stringify(result), /token_hash|customer_organization_id|observer_site_id/);
  assert.ok(state.session.last_used_at);
});

test("a token cannot change audience or origin, survive origin removal, or confer a missing scope", async () => {
  const { dashboard, state } = fixture();
  for (const origin of [null, "null", "https://other.example.invalid", `${allowedOrigin}/path`, "not-an-origin"]) {
    await assert.rejects(dashboard(origin), { message: "EMBEDDED_ORIGIN_DENIED" });
  }
  await assert.rejects(dashboard(allowedOrigin, "other-audience"), { message: "EMBEDDED_AUDIENCE_DENIED" });
  await assert.rejects(dashboard(allowedOrigin, audience, "doemb_wrong"), { message: "EMBEDDED_SESSION_INACTIVE" });
  state.session.digital_observer_partners.allowed_embed_origins = [];
  await assert.rejects(dashboard(), { message: "EMBEDDED_ORIGIN_DENIED" });
  state.session.digital_observer_partners.allowed_embed_origins = [allowedOrigin];
  state.session.scopes = ["events.read"];
  await assert.rejects(dashboard(), { message: "EMBEDDED_SCOPE_DENIED" });
  assert.ok(!state.reads.includes(camerasTable));
});

test("tenant, current Site link, customer status and partner ownership are checked before resource reads", async () => {
  const cases = [
    [({ session }) => { session.digital_observer_partner_customers.partner_id = "other-partner"; }, "EMBEDDED_SESSION_INACTIVE"],
    [({ session }) => { session.digital_observer_partner_customers.customer_status = "suspended"; }, "EMBEDDED_SESSION_INACTIVE"],
    [({ session }) => { session.digital_observer_partners.partner_status = "revoked"; }, "EMBEDDED_SESSION_INACTIVE"],
    [(state) => { state.linked = false; }, "EMBEDDED_SITE_SCOPE_DENIED"],
    [(state) => { state.siteOrg = "other-tenant"; }, "EMBEDDED_SITE_SCOPE_DENIED"],
  ];
  for (const [mutate, message] of cases) {
    const { dashboard, state } = fixture();
    mutate(state);
    await assert.rejects(dashboard(), { message });
    assert.ok(!state.reads.includes(camerasTable));
  }
});

test("revocation and expiry deny both before reads and when they occur during a read", async () => {
  const revoke = (session) => { session.revoked_at = new Date().toISOString(); };
  const expire = (session) => { session.expires_at = "2000-01-01T00:00:00.000Z"; };
  const invalid = (session) => { session.expires_at = "invalid"; };
  for (const mutate of [revoke, expire, invalid]) {
    const { dashboard, state } = fixture();
    mutate(state.session);
    await assert.rejects(dashboard(), { message: "EMBEDDED_SESSION_INACTIVE" });
    assert.ok(!state.reads.includes(camerasTable));
  }
  for (const mutate of [revoke, expire]) {
    const { dashboard, state } = fixture();
    state.duringCameraRead = () => mutate(state.session);
    await assert.rejects(dashboard(), { message: "EMBEDDED_SESSION_INACTIVE" });
    assert.ok(state.reads.includes(camerasTable));
    assert.equal(state.session.last_used_at, undefined);
  }
});

test("a failure confirming the completed read withholds the dashboard", async () => {
  const { dashboard, state } = fixture();
  state.confirmError = true;
  await assert.rejects(dashboard(), { message: "EMBEDDED_SESSION_UNAVAILABLE" });
});
