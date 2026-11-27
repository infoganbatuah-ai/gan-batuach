import assert from "node:assert/strict";
import test from "node:test";
import { verifyDigitalObserverWebhook } from "../../examples/digital-observer-external-api/client.mjs";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { externalWebhookPayload, externalWebhookSignature } = loadTs("lib/domain/digital-observer/external-api-contract.ts");
const { transitionForProviderOutcome } = loadTs("lib/domain/digital-observer/notification-orchestration.ts");
const start = new Date("2026-11-27T10:00:00Z");
const signingKey = { secret: "synthetic-webhook-key", keyVersion: 1 };
const delivery = {
  id: "synthetic-delivery", eventType: "event.created", organizationId: "tenant-a", siteId: "site-a",
  resourceId: "event-a", occurredAt: start.toISOString(), productPath: "/digital-observer/events",
};

function receiver() {
  const accepted = new Map();
  let unavailable = false;
  return {
    accepted,
    failNext() { unavailable = true; },
    receive(signed) {
      if (!verifyDigitalObserverWebhook({ ...signed, ...signingKey })) return 401;
      const body = JSON.parse(signed.payload);
      if (body.id !== signed.deliveryId || body.organization_id !== delivery.organizationId || body.site_id !== delivery.siteId) return 403;
      if (unavailable) {
        unavailable = false;
        return 503;
      }
      const existing = accepted.get(signed.deliveryId);
      if (existing !== undefined) return existing === signed.payload ? 204 : 409;
      accepted.set(signed.deliveryId, signed.payload);
      return 204;
    },
  };
}

function sign(input, attemptAt = start) {
  const payload = JSON.stringify(externalWebhookPayload(input));
  const timestamp = Math.floor(attemptAt.getTime() / 1000);
  const fields = { payload, timestamp, deliveryId: input.id };
  return { ...fields, signature: externalWebhookSignature({ ...fields, ...signingKey }), now: timestamp };
}

test("reference-only payloads exclude private fields and reject URL components outside the product path", () => {
  const payload = externalWebhookPayload({
    ...delivery, storage_path: "private-fixture", stream_url: "https://fixture.invalid/private", footage: "synthetic-frame",
  });
  assert.deepEqual(payload, {
    version: "do-external-webhook-v1", id: delivery.id, event_type: delivery.eventType,
    occurred_at: delivery.occurredAt, organization_id: delivery.organizationId, site_id: delivery.siteId,
    resource: { id: delivery.resourceId, product_path: delivery.productPath }, sensitive_media_embedded: false,
  });
  for (const suffix of ["?private_reference=fixture", "#private-reference", "/%2Ffixture", "/../fixture", "\\fixture"]) {
    assert.throws(() => externalWebhookPayload({ ...delivery, productPath: delivery.productPath + suffix }), {
      message: "INVALID_PRODUCT_PATH",
    });
  }
});

test("independent recipient acknowledges a bounded retry, deduplicates the same ID, and rejects changed scope", () => {
  const endpoint = receiver();
  endpoint.failNext();
  assert.equal(endpoint.receive(sign(delivery)), 503);
  assert.equal(endpoint.accepted.size, 0);
  const policy = { maxAttempts: 2, expiresAt: new Date(start.getTime() + 300_000).toISOString() };
  const retry = transitionForProviderOutcome({ ...policy, outcome: "temporary_failure", attemptCount: 1, now: start });
  assert.equal(retry.status, "retry_scheduled");
  const nextAttempt = new Date(retry.retryAt);
  assert.ok(nextAttempt > start && nextAttempt < new Date(policy.expiresAt));
  const signed = sign(delivery, nextAttempt);
  assert.equal(endpoint.receive(signed), 204);
  const ack = transitionForProviderOutcome({ ...policy, outcome: "acknowledged", attemptCount: 2, now: nextAttempt });
  assert.equal(ack.status, "acknowledged");
  assert.equal(ack.retryAt, null);
  assert.equal(endpoint.receive(signed), 204);
  assert.equal(endpoint.accepted.size, 1);
  assert.equal(endpoint.receive(sign({ ...delivery, resourceId: "different-event" }, nextAttempt)), 409);
  assert.equal(endpoint.receive(sign({ ...delivery, siteId: "site-b" }, nextAttempt)), 403);
  assert.equal(endpoint.receive(sign({ ...delivery, organizationId: "tenant-b" }, nextAttempt)), 403);
  assert.equal(endpoint.receive({ ...signed, now: signed.timestamp + 301 }), 401);
  assert.equal(endpoint.accepted.get(delivery.id), signed.payload);
  const exhausted = transitionForProviderOutcome({ ...policy, outcome: "temporary_failure", attemptCount: 2, now: nextAttempt });
  assert.equal(exhausted.status, "dead_letter");
  assert.equal(exhausted.retryAt, null);
  assert.equal(transitionForProviderOutcome({ ...policy, outcome: "unknown_outcome", attemptCount: 1, now: start }).retryAt, null);
});
