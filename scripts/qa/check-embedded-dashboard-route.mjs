import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";
import { audience, camerasTable, embeddedDashboardFixture, token } from "./embedded-dashboard-fixture.mjs";

const { DigitalObserverEmbeddedClient } = loadTs("packages/digital-observer-sdk/src/browser.ts");
const { transitionPartnerCustomer } = loadTs("lib/domain/digital-observer/partner-platform-service.ts", { "@/lib/supabase/admin": {} });
const endpoint = "https://observer.example.invalid/api/digital-observer/embed/v1/dashboard";
const allowedOrigin = "https://partner.example.invalid";

function fixture() {
  const { state, admin, GET, OPTIONS } = embeddedDashboardFixture(allowedOrigin);
  return {
    state,
    transition(status) {
      return transitionPartnerCustomer(admin, { partnerId: "partner", organizationId: "partner-org", actorId: "fixture-owner",
        actorRole: "organization_owner", customerId: "customer", status, reason: "fixture lifecycle", correlationId: "fixture-trace" });
    },
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

test("suspension with an incomplete token revocation cannot revive a previously issued token", async () => {
  const { dashboard, transition, state } = fixture();
  assert.equal((await dashboard()).site.id, "site");
  state.revocationError = true;
  await assert.rejects(transition("suspended"), /PARTNER_CUSTOMER_SESSION_REVOCATION_FAILED/);
  assert.equal(state.session.revoked_at, null);
  assert.equal(state.session.digital_observer_partner_customers.customer_status, "suspended");
  await assert.rejects(transition("active"), /PARTNER_CUSTOMER_SESSION_REVOCATION_FAILED/);
  assert.equal(state.session.digital_observer_partner_customers.customer_status, "suspended");
  await assert.rejects(dashboard(), /EMBEDDED_SESSION_INACTIVE/);

  state.revocationError = false;
  assert.equal((await transition("active")).customer_status, "active");
  assert.ok(state.session.revoked_at);
  await assert.rejects(dashboard(), /EMBEDDED_SESSION_INACTIVE/);
});
