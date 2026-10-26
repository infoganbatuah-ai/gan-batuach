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

const { dispatchQueuedDelivery } = await import("../../lib/domain/digital-observer/notification-delivery-service.ts");
const now = new Date("2026-10-26T10:00:00Z");
const providerKey = "digital-observer-sandbox-email";

function fakeAdmin({ attemptError = null, finalError = false } = {}) {
  const state = { delivery: { id: "delivery-a", observer_site_id: "site-a", recipient_profile_id: "recipient-a",
    channel: "email", severity: "high", provider_mode: "sandbox", delivery_status: "queued",
    attempt_count: 0, max_attempts: 3, expires_at: "2100-01-01T00:00:00Z",
    stable_delivery_id: "stable-delivery-a", policy_snapshot: {},
    metadata: { provider_key: providerKey, content: { title: "QA", body: "Synthetic" }, external_message_sent: false } },
    attemptInserts: 0, finalUpdates: 0, storedAttempts: [] };
  const admin = { from(table) {
    let op = "read"; let payload = null;
    const filters = new Map();
    const query = {
      select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      in(key, value) { filters.set(key, value); return this; },
      or() { return this; }, gt() { return this; }, gte() { return this; },
      update(value) { op = "update"; payload = value; return this; },
      insert(value) {
        assert.equal(table, "digital_observer_delivery_attempts");
        state.attemptInserts++;
        if (!attemptError) state.storedAttempts.push(value);
        return Promise.resolve({ error: attemptError });
      },
      async maybeSingle() {
        if (table === "digital_observer_notification_deliveries") {
          if (op !== "update" || filters.get("id") !== state.delivery.id) return { data: null, error: null };
          if (payload.delivery_status === "dispatching") {
            if (state.delivery.delivery_status !== "queued") return { data: null, error: null };
          } else {
            state.finalUpdates++;
            if (finalError) return { data: null, error: { code: "synthetic" } };
            if (state.delivery.delivery_status !== "dispatching"
              || filters.get("attempt_count") !== state.delivery.attempt_count) return { data: null, error: null };
          }
          Object.assign(state.delivery, payload);
          return { data: { ...state.delivery }, error: null };
        }
        const rows = {
          observer_sites: { id: "site-a", owner_profile_id: "recipient-a", site_type: "home", garden_id: null },
          profiles: { id: "recipient-a", active: true, role: "parent" },
          observer_site_memberships: null,
          observer_alert_channel_settings: { enabled: true, package_allowed: true,
            channel_eligible: true, consent_or_legal_basis: true, revoked_at: null,
            rate_limit_per_hour: 20 },
          digital_observer_provider_channels: { provider_key: providerKey, provider_mode: "sandbox",
            active: true, configuration_status: "ready", rate_limit_per_minute: 10,
            rate_limit_per_day: 100 }
        };
        if (!(table in rows)) throw new Error(`UNEXPECTED_TABLE:${table}`);
        return { data: rows[table], error: null };
      },
      then(resolve, reject) {
        assert.equal(table, "digital_observer_delivery_attempts");
        return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject);
      }
    };
    return query;
  } };
  return { admin, state };
}

test("duplicate attempt is unverified, so delivery cannot advance", async () => {
  const { admin, state } = fakeAdmin({ attemptError: { code: "23505" } });
  await assert.rejects(dispatchQueuedDelivery(admin, { deliveryId: "delivery-a", now,
    sandboxBehavior: "success" }), /DELIVERY_ATTEMPT_DUPLICATE_UNVERIFIED/);
  assert.equal(state.attemptInserts, 1);
  assert.equal(state.finalUpdates, 0);
  assert.equal(state.delivery.delivery_status, "dispatching");
});

test("other attempt persistence failure also blocks terminal update", async () => {
  const { admin, state } = fakeAdmin({ attemptError: { code: "synthetic" } });
  await assert.rejects(dispatchQueuedDelivery(admin, { deliveryId: "delivery-a", now,
    sandboxBehavior: "success" }), /DELIVERY_ATTEMPT_PERSIST_FAILED/);
  assert.equal(state.finalUpdates, 0);
});

test("persisted sandbox result can advance while keeping attempt identity", async () => {
  const { admin, state } = fakeAdmin();
  const result = await dispatchQueuedDelivery(admin, { deliveryId: "delivery-a", now,
    sandboxBehavior: "success" });
  assert.equal(result.delivery.delivery_status, "sent");
  assert.equal(state.finalUpdates, 1);
  assert.equal(state.storedAttempts.length, 1);
  assert.equal(state.storedAttempts[0].observer_site_id, "site-a");
  assert.equal(state.storedAttempts[0].provider_key, providerKey);
  assert.equal(state.storedAttempts[0].request_id, "stable-delivery-a:1");
});

test("delivery update failure still leaves a persisted attempt: separate atomicity gap", async () => {
  const { admin, state } = fakeAdmin({ finalError: true });
  await assert.rejects(dispatchQueuedDelivery(admin, { deliveryId: "delivery-a", now,
    sandboxBehavior: "unknown_outcome" }), /DELIVERY_TERMINAL_UPDATE_FAILED/);
  assert.equal(state.storedAttempts.length, 1);
  assert.equal(state.storedAttempts[0].outcome, "unknown_outcome");
  assert.equal(state.delivery.delivery_status, "dispatching");
  assert.equal(state.finalUpdates, 1);
});
