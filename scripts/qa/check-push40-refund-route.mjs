import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const siteId = "00000000-0000-4000-8000-000000000041";
const otherSiteId = "00000000-0000-4000-8000-000000000042";
const actorId = "00000000-0000-4000-8000-000000000043";
const otherId = "00000000-0000-4000-8000-000000000044";
const paymentId = "00000000-0000-4000-8000-000000000045";
const refundInput = { action: "refund", observer_site_id: siteId, payment_event_id: paymentId,
  amount_minor: 100, currency: "ILS", reason: "Approved refund", idempotency_key: "refund-review-key" };

function fixture({ site = { id: siteId, active: true, site_type: "home", garden_id: null, owner_profile_id: actorId },
  membership = null, siteError = null, membershipError = null, siteAccess = true,
  sessionActive = true, role = "parent", appAdmin = false, refundError = null } = {}) {
  const state = { queries: [], refundCalls: [], cancelCalls: [], reconcileCalls: [], adminClients: 0 };
  const db = { from(table) {
    const query = { table, filters: [] };
    state.queries.push(query);
    const builder = {
      select(columns) { query.columns = columns; return this; },
      eq(column, value) { query.filters.push(["eq", column, value]); return this; },
      in(column, values) { query.filters.push(["in", column, values]); return this; },
      async maybeSingle() {
        assert(["observer_sites", "observer_site_memberships"].includes(table), "Refund gate may only read direct Site and membership");
        if (table === "observer_sites") return { data: site, error: siteError };
        return { data: membership, error: membershipError };
      }
    };
    return builder;
  } };
  const session = sessionActive ? { profile: { id: actorId, role }, user: { app_metadata: { digital_observer_admin: appAdmin } }, supabase: db } : null;
  const route = loadTs("app/api/digital-observer/billing/route.ts", {
    "@/lib/api": {
      fail: (message, status = 400) => Response.json({ error: message }, { status }),
      ok: (data, status = 200) => Response.json({ data }, { status }),
      handleRouteError: (error) => Response.json({ error: error instanceof Error ? error.message : "UNKNOWN" }, { status: 500 })
    },
    "@/lib/domain/digital-observer/access": {
      getDigitalObserverApiUser: async () => session,
      // The billing summary deliberately grants broad read access in this
      // fixture; the refund gate must not mistake it for refund authority.
      getObserverSiteAccess: async () => siteAccess ? { id: siteId, site_type: "home", owner_profile_id: site?.owner_profile_id } : null
    },
    "@/lib/domain/digital-observer/commercial-billing-service": {
      requestRefund: async (_admin, input) => { state.refundCalls.push(input); if (refundError) throw refundError; return { refund: { id: "synthetic-refund" }, duplicate: false }; },
      cancelSubscription: async (_admin, input) => { state.cancelCalls.push(input); return { id: "synthetic-cancellation" }; },
      runCommercialReconciliation: async (_admin, input) => { state.reconcileCalls.push(input); return { duplicate: false }; },
      activateControlledTrial: async () => { throw Error("UNEXPECTED_TRIAL"); },
      createCheckoutIntent: async () => { throw Error("UNEXPECTED_CHECKOUT"); },
      schedulePlanChange: async () => { throw Error("UNEXPECTED_PLAN_CHANGE"); }
    },
    "@/lib/supabase/admin": {
      isAdminClientConfigured: () => true,
      createAdminClient: () => { state.adminClients++; return {}; }
    }
  });
  const post = (input = refundInput) => route.POST(new Request("http://fixture.invalid/api/digital-observer/billing", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input)
  }));
  return { post, state };
}

test("direct Site owner and active owner/admin memberships may reach only the existing refund service", async () => {
  for (const options of [
    {},
    { site: { id: siteId, active: true, site_type: "business", garden_id: null, owner_profile_id: otherId },
      membership: { observer_site_id: siteId, profile_id: actorId, member_role: "owner", active: true } },
    { site: { id: siteId, active: true, site_type: "office", garden_id: null, owner_profile_id: otherId },
      membership: { observer_site_id: siteId, profile_id: actorId, member_role: "admin", active: true } }
  ]) {
    const { post, state } = fixture(options);
    assert.equal((await post()).status, 201);
    assert.equal(state.refundCalls.length, 1);
    assert.equal(state.refundCalls[0].actorId, actorId);
    assert.equal(state.refundCalls[0].siteId, siteId);
    assert.deepEqual(state.queries[0].filters, [["eq", "id", siteId]]);
    if (options.membership) {
      assert.deepEqual(state.queries[1].filters, [["eq", "observer_site_id", siteId],
        ["eq", "profile_id", actorId], ["eq", "active", true], ["in", "member_role", ["owner", "admin"]]]);
    }
  }
});

test("global admin and organization-only billing access do not imply direct refund authority", async () => {
  for (const options of [{ role: "admin" }, { appAdmin: true }, { role: "organization_admin" }]) {
    const { post, state } = fixture({ ...options,
      site: { id: siteId, active: true, site_type: "home", garden_id: null, owner_profile_id: otherId } });
    assert.equal((await post()).status, 403);
    assert.equal(state.refundCalls.length, 0);
    assert.equal(state.adminClients, 0);
  }
});

test("viewer, billing-only and revoked memberships cannot request a refund", async () => {
  for (const membership of [
    { observer_site_id: siteId, profile_id: actorId, member_role: "viewer", active: true },
    { observer_site_id: siteId, profile_id: actorId, member_role: "billing", active: true },
    { observer_site_id: siteId, profile_id: actorId, member_role: "admin", active: false },
    { observer_site_id: otherSiteId, profile_id: actorId, member_role: "admin", active: true },
    { observer_site_id: siteId, profile_id: otherId, member_role: "owner", active: true }
  ]) {
    const { post, state } = fixture({ site: { id: siteId, active: true, site_type: "home", garden_id: null, owner_profile_id: otherId }, membership });
    assert.equal((await post()).status, 403);
    assert.equal(state.refundCalls.length, 0);
  }
});

test("Garden, inactive, wrong, unclassified and inaccessible Sites fail closed", async () => {
  const base = { id: siteId, active: true, site_type: "home", garden_id: null, owner_profile_id: actorId };
  for (const options of [
    { site: { ...base, garden_id: otherId } }, { site: { ...base, site_type: "kindergarten" } },
    { site: { ...base, active: false } }, { site: { ...base, id: otherSiteId } },
    { site: { ...base, site_type: null } }, { site: null }, { siteAccess: false }
  ]) {
    const { post, state } = fixture(options);
    assert.equal((await post()).status, 403);
    assert.equal(state.refundCalls.length, 0);
  }
});

test("missing or rejected Development session denies before any refund or Site query", async () => {
  const { post, state } = fixture({ sessionActive: false });
  assert.equal((await post()).status, 401);
  assert.equal(state.queries.length, 0);
  assert.equal(state.refundCalls.length, 0);
});

test("Site or membership database errors and refund-service failure never report refund success", async () => {
  const siteFailure = fixture({ siteError: { code: "XX000" } });
  assert.equal((await siteFailure.post()).status, 403);
  assert.equal(siteFailure.state.refundCalls.length, 0);
  const membershipFailure = fixture({ site: { id: siteId, active: true, site_type: "home", garden_id: null, owner_profile_id: otherId },
    membershipError: { code: "XX000" } });
  assert.equal((await membershipFailure.post()).status, 403);
  assert.equal(membershipFailure.state.refundCalls.length, 0);
  const refundFailure = fixture({ refundError: new Error("SYNTHETIC_DATABASE_FAILURE") });
  assert.equal((await refundFailure.post()).status, 500);
  assert.equal(refundFailure.state.refundCalls.length, 1);
});

test("non-refund billing actions retain their existing access path", async () => {
  const cancellation = fixture({ site: null });
  assert.equal((await cancellation.post({ action: "cancel", observer_site_id: siteId,
    reason: "Owner-requested cancellation", idempotency_key: "cancel-review-key" })).status, 201);
  assert.equal(cancellation.state.cancelCalls.length, 1);
  assert.equal(cancellation.state.queries.length, 0);
  const reconciliation = fixture({ site: null, role: "admin" });
  assert.equal((await reconciliation.post({ action: "reconcile", observer_site_id: siteId,
    period_start: "2026-10-01T00:00:00.000Z", period_end: "2026-10-02T00:00:00.000Z" })).status, 201);
  assert.equal(reconciliation.state.reconcileCalls.length, 1);
  assert.equal(reconciliation.state.queries.length, 0);
});
