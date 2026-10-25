import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const domain = await import("../../lib/domain/digital-observer/notification-orchestration.ts");
const { queueAuthorizedDelivery } = await import("../../lib/domain/digital-observer/notification-delivery-service.ts");
const input = { actionIntentId: "intent-a", observerSiteId: "site-a", recipientProfileId: "recipient-a",
  channel: "email", severity: "high", priority: 8, title: "Reviewed alert", body: "Open the Product",
  productPath: "/digital-observer/alerts", ttlSeconds: 600 };
const originalTime = new Date("2026-10-25T10:00:00.000Z");
const retryTime = new Date("2026-10-25T10:01:00.000Z");
const originalRecipient = { profileId: input.recipientProfileId, observerSiteId: input.observerSiteId,
  activeMembership: true, memberRole: "operator", allowedSiteIds: [input.observerSiteId],
  channelEnabled: true, channelEligible: true, consentOrLegalBasis: true, revoked: false,
  quietHours: null, emergencyOverrideAuthorized: false };
const originalPlan = domain.createDeliveryPlan({ intentId: input.actionIntentId, observerSiteId: input.observerSiteId,
  recipient: originalRecipient, channel: input.channel, providerMode: "sandbox", severity: input.severity,
  priority: input.priority, now: originalTime, ttlSeconds: input.ttlSeconds });
const originalContent = domain.minimizeNotificationContent({ title: input.title, body: input.body,
  productPath: input.productPath, severity: input.severity });

function storedRow(overrides = {}) {
  return { id: "delivery-a", observer_site_id: input.observerSiteId, action_intent_id: input.actionIntentId,
    recipient_profile_id: input.recipientProfileId, channel: input.channel, provider_mode: "sandbox",
    delivery_status: "queued", attempt_count: 0, max_attempts: 3,
    expires_at: originalPlan.expiresAt, stable_delivery_id: originalPlan.stableDeliveryId,
    dedupe_key: originalPlan.idempotencyKey, severity: input.severity, priority: input.priority,
    content_classification: "minimal", authorization_snapshot: originalPlan.authorizationSnapshot,
    policy_snapshot: { ...originalPlan.policySnapshot, suppression_reason: null },
    metadata: { content: originalContent, provider_key: "sandbox-email", external_message_sent: false },
    ...overrides };
}

// In-memory PostgREST-shaped boundary: ignoreDuplicates returns no inserted
// row, then the service fetches the existing one. No DB or provider exists.
function duplicateAdmin(existing, { revoked = false, changedProvider = false } = {}) {
  const observed = { inserts: 0, duplicateUpserts: 0, deliveryLookups: 0, providerCalls: 0 };
  let inserted = null;
  const admin = { from(table) {
    if (table === "digital_observer_delivery_attempts" || table === "push_notification_logs") {
      observed.providerCalls++;
      throw new Error("PROVIDER_PATH_MUST_NOT_RUN");
    }
    const query = {
      select() { return this; }, eq() { return this; }, gte() { return this; }, not() { return this; },
      upsert(body) {
        assert.equal(table, "digital_observer_notification_deliveries");
        if (existing?.observer_site_id === body.observer_site_id && existing?.dedupe_key === body.dedupe_key) {
          observed.duplicateUpserts++;
        } else {
          observed.inserts++;
          inserted = { id: "new-delivery", ...body };
        }
        return this;
      },
      async maybeSingle() {
        switch (table) {
          case "digital_observer_action_intents": return { data: { id: input.actionIntentId,
            observer_site_id: input.observerSiteId, intent_status: "authorized",
            human_confirmation_required: false, lawful_use_approval_required: false }, error: null };
          case "observer_sites": return { data: { id: input.observerSiteId, owner_profile_id: "other-owner",
            site_type: "home", garden_id: null }, error: null };
          case "profiles": return { data: { id: input.recipientProfileId, active: true, role: "parent" }, error: null };
          case "observer_site_memberships": return { data: { member_role: "operator", active: !revoked }, error: null };
          case "observer_alert_channel_settings": return { data: { enabled: !revoked,
            package_allowed: true, channel_eligible: true, consent_or_legal_basis: true,
            revoked_at: revoked ? retryTime.toISOString() : null, rate_limit_per_hour: 20 }, error: null };
          case "digital_observer_provider_channels": return { data: { active: true,
            configuration_status: "ready", provider_mode: changedProvider ? "disabled" : "sandbox",
            provider_key: changedProvider ? "disabled" : "sandbox-email" }, error: null };
          case "digital_observer_notification_deliveries": return { data: inserted, error: null };
          default: throw new Error(`UNEXPECTED_TABLE:${table}`);
        }
      },
      async single() {
        assert.equal(table, "digital_observer_notification_deliveries");
        observed.deliveryLookups++;
        return { data: existing, error: existing ? null : { message: "missing" } };
      },
      then(resolve, reject) {
        assert.equal(table, "digital_observer_notification_deliveries");
        return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject);
      }
    };
    return query;
  } };
  return { admin, observed };
}

test("identical duplicate returns stored row without a fresh decision-time plan", async () => {
  const row = storedRow();
  const { admin, observed } = duplicateAdmin(row);
  const result = await queueAuthorizedDelivery(admin, { ...input, now: retryTime, ttlSeconds: 3600 });
  assert.equal(result.duplicate, true);
  assert.equal(result.delivery, row);
  assert.equal(result.plan, null);
  assert.equal(observed.deliveryLookups, 1);
  assert.equal(observed.duplicateUpserts, 1);
  assert.equal(observed.inserts, 0);
  assert.equal(observed.providerCalls, 0);
  assert.equal(row.expires_at, originalPlan.expiresAt, "retry cannot rewrite the original expiry");
});

test("recipient revocation and provider changes do not rewrite the old snapshot", async () => {
  const row = storedRow();
  const snapshot = structuredClone({ authorization: row.authorization_snapshot, policy: row.policy_snapshot });
  const { admin, observed } = duplicateAdmin(row, { revoked: true, changedProvider: true });
  const result = await queueAuthorizedDelivery(admin, { ...input, now: retryTime });
  assert.equal(result.duplicate, true);
  assert.equal(result.plan, null);
  assert.deepEqual({ authorization: row.authorization_snapshot, policy: row.policy_snapshot }, snapshot);
  assert.equal(observed.providerCalls, 0);
  assert.equal(domain.assertRecipientAuthorization({ ...originalRecipient, activeMembership: false, revoked: true }, input.observerSiteId, input.channel).allowed, false);
  const serviceSource = readFileSync(new URL("../../lib/domain/digital-observer/notification-delivery-service.ts", import.meta.url), "utf8");
  assert.match(serviceSource, /loadRecipientAuthorization\(admin, \{ siteId: delivery\.observer_site_id/);
  assert.match(serviceSource, /assertRecipientAuthorization\(recipient\.authorization/);
});

test("changed content and corrupted intent, recipient or channel reject duplicate", async () => {
  for (const candidate of [storedRow(), storedRow({ action_intent_id: "intent-b" }),
    storedRow({ recipient_profile_id: "recipient-b" }), storedRow({ channel: "push" })]) {
    const { admin, observed } = duplicateAdmin(candidate);
    const changed = candidate.action_intent_id === input.actionIntentId
      && candidate.recipient_profile_id === input.recipientProfileId && candidate.channel === input.channel;
    await assert.rejects(queueAuthorizedDelivery(admin, { ...input,
      body: changed ? "Changed reviewed content" : input.body, now: retryTime }),
    /DELIVERY_REPLAY_(SEMANTIC_CONFLICT|RECORD_INCOMPLETE)/);
    assert.equal(observed.inserts, 0);
    assert.equal(observed.providerCalls, 0);
  }
});

test("site, dedupe and stable identity mismatch reject even when the lookup returns a row", () => {
  for (const row of [storedRow({ observer_site_id: "site-b" }),
    storedRow({ dedupe_key: "delivery:other" }), storedRow({ stable_delivery_id: "other" })]) {
    assert.throws(() => domain.assertEquivalentStoredDelivery(row, {
      intentId: input.actionIntentId, plan: originalPlan, content: originalContent
    }), /DELIVERY_REPLAY_SEMANTIC_CONFLICT/);
  }
});

test("partial snapshot or missing original content fails closed", async () => {
  for (const row of [storedRow({ authorization_snapshot: {} }),
    storedRow({ policy_snapshot: {} }), storedRow({ metadata: {} }), storedRow({ expires_at: null })]) {
    const { admin, observed } = duplicateAdmin(row);
    await assert.rejects(queueAuthorizedDelivery(admin, { ...input, now: retryTime }), /DELIVERY_REPLAY_RECORD_INCOMPLETE/);
    assert.equal(observed.providerCalls, 0);
  }
});
