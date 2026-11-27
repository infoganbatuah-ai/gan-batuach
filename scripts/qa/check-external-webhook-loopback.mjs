import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { verifyDigitalObserverWebhook } from "../../examples/digital-observer-external-api/client.mjs";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { externalWebhookPayload, externalWebhookSignature } = loadTs("lib/domain/digital-observer/external-api-contract.ts");
const { transitionForProviderOutcome } = loadTs("lib/domain/digital-observer/notification-orchestration.ts");
const { authorizeExternalApiSite } = loadTs("lib/domain/digital-observer/external-api-service.ts", {
  "./commercial-billing-service": { assertCommercialEntitlement: async () => undefined },
  "@/lib/supabase/admin": {},
});

const start = new Date("2026-11-27T10:00:00Z");
const expiresAt = new Date(start.getTime() + 300_000).toISOString();
const signingKey = { secret: "fixture-only-signing-key", keyVersion: 1 };

test("one stored Site and subscription authorize a local HTTP retry and ACK", { timeout: 12_000 }, async (t) => {
  const site = { id: "site-a", digital_observer_organization_id: "org-a", garden_id: null, site_type: "home" };
  const events = [
    { id: "event-a", observer_site_id: site.id, created_at: start.toISOString() },
    { id: "other-event", observer_site_id: "site-b", created_at: start.toISOString() },
  ];
  const subscription = {
    id: "subscription-a", organization_id: "org-a", observer_site_id: site.id, service_account_id: "account-a",
    active: true, revoked_at: null, provider_mode: "sandbox", contract_version: "do-external-webhook-v1",
    allowed_event_types: ["event.created"],
  };
  const account = {
    organizationId: "org-a", serviceAccountId: "account-a", permissions: ["events.view", "notifications.manage"],
    allSites: false, siteIds: [site.id], requestId: "local-authorization-check",
  };
  const admin = {
    from(table) {
      if (table === "digital_observer_enterprise_audit_events") return { insert: async () => ({ error: null }) };
      const rows = table === "observer_sites" ? [site] : table === "digital_observer_partner_service_accounts" ? [] : null;
      assert.ok(rows, `Unexpected authorization read ${table}`);
      const filters = [];
      return {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { return this.eq(key, value); },
        neq(key, value) { filters.push((row) => row[key] !== value); return this; },
        async maybeSingle() { return { data: rows.find((row) => filters.every((filter) => filter(row))) ?? null, error: null }; },
      };
    },
  };

  const seen = [];
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/receiver") return response.writeHead(404).end();
    try {
      const buffer = [];
      for await (const chunk of request) buffer.push(chunk);
      const payload = Buffer.concat(buffer).toString("utf8");
      const deliveryId = request.headers["x-do-delivery-id"];
      const timestamp = Number(request.headers["x-do-timestamp"]);
      const keyVersion = Number(request.headers["x-do-key-version"]);
      const signature = request.headers["x-do-signature"];
      if (keyVersion !== signingKey.keyVersion || !verifyDigitalObserverWebhook({
        payload, deliveryId, timestamp, keyVersion, signature, secret: signingKey.secret, now: Date.parse(expiresAt) / 1000,
      })) return response.writeHead(401).end();
      seen.push({ deliveryId, payload });
      return response.writeHead(seen.length === 1 ? 503 : 204).end();
    } catch (error) {
      t.diagnostic(error.message);
      return response.writeHead(500).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const receiver = `http://127.0.0.1:${server.address().port}/receiver`;

  // Test-only bridge. Canonical IDs come from these synthetic records, and
  // the destination is the socket opened by this test.
  async function attempt({ eventId, subscriptionId }, attemptCount, now) {
    const event = events.find(({ id }) => id === eventId);
    if (!event || subscriptionId !== subscription.id || !subscription.active || subscription.revoked_at ||
      subscription.observer_site_id !== event.observer_site_id || subscription.organization_id !== account.organizationId ||
      subscription.service_account_id !== account.serviceAccountId || subscription.provider_mode !== "sandbox" ||
      subscription.contract_version !== "do-external-webhook-v1" || !subscription.allowed_event_types.includes("event.created")) {
      throw new Error("FIXTURE_SUBSCRIPTION_DENIED");
    }
    const authorizedSite = await authorizeExternalApiSite(admin, account, { siteId: event.observer_site_id, scope: "webhooks.write" });
    await authorizeExternalApiSite(admin, account, { siteId: authorizedSite.id, scope: "events.read" });
    const deliveryId = `${subscription.id}:${event.id}`;
    const payload = JSON.stringify(externalWebhookPayload({
      id: deliveryId, eventType: "event.created", organizationId: authorizedSite.digital_observer_organization_id,
      siteId: authorizedSite.id, resourceId: event.id, occurredAt: event.created_at, productPath: "/digital-observer/alerts",
    }));
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = externalWebhookSignature({ payload, timestamp, deliveryId, ...signingKey });
    const result = await fetch(receiver, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(2_000), body: payload,
      headers: { "content-type": "application/json", "x-do-delivery-id": deliveryId, "x-do-timestamp": String(timestamp),
        "x-do-key-version": String(signingKey.keyVersion), "x-do-signature": signature },
    });
    assert.ok(result.status === 204 || result.status === 503);
    const outcome = result.status === 204 ? "acknowledged" : "temporary_failure";
    return transitionForProviderOutcome({ outcome, attemptCount, maxAttempts: 2, now, expiresAt });
  }

  const input = { eventId: events[0].id, subscriptionId: subscription.id };
  await assert.rejects(attempt({ ...input, eventId: "other-event" }, 1, start), /FIXTURE_SUBSCRIPTION_DENIED/);
  await assert.rejects(attempt({ ...input, subscriptionId: "other-subscription" }, 1, start), /FIXTURE_SUBSCRIPTION_DENIED/);
  assert.equal(seen.length, 0);
  const first = await attempt(input, 1, start);
  assert.equal(first.status, "retry_scheduled");
  const retryAt = new Date(first.retryAt);
  assert.ok(retryAt > start && retryAt < new Date(expiresAt));

  subscription.revoked_at = retryAt.toISOString();
  await assert.rejects(attempt(input, 2, retryAt), /FIXTURE_SUBSCRIPTION_DENIED/);
  subscription.revoked_at = null;
  site.digital_observer_organization_id = "new-org";
  await assert.rejects(attempt(input, 2, retryAt), /EXTERNAL_API_SITE_SCOPE_DENIED/);
  site.digital_observer_organization_id = "org-a";
  account.permissions = ["notifications.manage"];
  await assert.rejects(attempt(input, 2, retryAt), /EXTERNAL_API_PERMISSION_DENIED/);
  account.permissions.push("events.view");
  assert.equal(seen.length, 1);

  const ack = await attempt(input, 2, retryAt);
  assert.deepEqual(ack, { status: "acknowledged", retryAt: null, terminal: true });
  assert.deepEqual(seen[0], seen[1]);
  assert.deepEqual(JSON.parse(seen[1].payload).resource, { id: events[0].id, product_path: "/digital-observer/alerts" });
});
