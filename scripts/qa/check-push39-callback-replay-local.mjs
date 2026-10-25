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

const { applyAuthenticatedCallback } = await import("../../lib/domain/digital-observer/notification-delivery-service.ts");
const at = new Date("2026-10-26T10:00:00.000Z");
const input = { deliveryId: "delivery-a", providerKey: "provider-a", providerEventId: "event-a",
  outcome: "success", occurredAt: "2026-10-26T09:59:00.000Z", safeMetadata: { sequence: 2, source: "synthetic" }, now: at };

function fakeDatabase({ status = "sent", callback = null, failUpdate = false, forcedDuplicate = false } = {}) {
  const state = { delivery: { id: input.deliveryId, observer_site_id: "site-a", delivery_status: status,
    attempt_count: 1, max_attempts: 3, expires_at: "2026-10-26T11:00:00.000Z",
    metadata: { provider_key: input.providerKey } }, callback, inserts: 0, updates: 0,
    providerCalls: 0, failUpdate, forcedDuplicate };
  const admin = { from(table) {
    if (!new Set(["digital_observer_notification_deliveries", "digital_observer_provider_callbacks"]).has(table)) {
      state.providerCalls++;
      throw new Error(`UNAUTHORIZED_PROVIDER_OR_TABLE:${table}`);
    }
    const filters = new Map();
    let operation = "read";
    let payload = null;
    const query = {
      select() { return this; },
      eq(key, value) { filters.set(key, value); return this; },
      insert(value) { operation = "insert"; payload = value; return this; },
      update(value) { operation = "update"; payload = value; return this; },
      async maybeSingle() {
        if (table === "digital_observer_provider_callbacks") {
          if (operation === "insert") {
            if (state.callback || state.forcedDuplicate) return { data: null, error: { code: "23505" } };
            state.callback = { id: "callback-a", received_at: at.toISOString(), ...payload };
            state.inserts++;
            return { data: { id: state.callback.id }, error: null };
          }
          const matched = state.callback?.provider_key === filters.get("provider_key")
            && state.callback?.provider_event_id === filters.get("provider_event_id") ? state.callback : null;
          return { data: matched, error: null };
        }
        if (operation === "update") {
          if (state.failUpdate) return { data: null, error: { message: "synthetic interruption" } };
          if (filters.get("id") !== state.delivery.id || filters.get("observer_site_id") !== state.delivery.observer_site_id
            || filters.get("delivery_status") !== state.delivery.delivery_status
            || filters.get("attempt_count") !== state.delivery.attempt_count) return { data: null, error: null };
          Object.assign(state.delivery, payload);
          state.updates++;
          return { data: { id: state.delivery.id, delivery_status: state.delivery.delivery_status }, error: null };
        }
        return { data: filters.get("id") === state.delivery.id ? { ...state.delivery } : null, error: null };
      }
    };
    return query;
  } };
  return { admin, state };
}

function storedCallback(overrides = {}) {
  return { id: "callback-a", observer_site_id: "site-a", delivery_id: input.deliveryId,
    provider_key: input.providerKey, provider_event_id: input.providerEventId,
    callback_status: input.outcome, signature_valid: true,
    occurred_at: input.occurredAt, safe_metadata: input.safeMetadata, ...overrides };
}

test("signed-gate service applies once; identical replay returns only verified current status", async () => {
  const { admin, state } = fakeDatabase();
  const first = await applyAuthenticatedCallback(admin, input);
  assert.deepEqual(first, { replay: false, deliveryStatus: "delivered" });
  assert.equal(state.inserts, 1);
  assert.equal(state.updates, 1);
  const replay = await applyAuthenticatedCallback(admin, { ...input,
    occurredAt: "2026-10-26T11:59:00.000+02:00",
    safeMetadata: { source: "synthetic", sequence: 2 } });
  assert.deepEqual(replay, { replay: true, deliveryStatus: "delivered" });
  assert.equal(state.inserts, 1);
  assert.equal(state.updates, 1);
  assert.equal(state.providerCalls, 0);
});

test("provider event ID collision on another delivery or Site is not replay", async () => {
  for (const original of [storedCallback({ delivery_id: "delivery-b" }),
    storedCallback({ observer_site_id: "site-b" })]) {
    const { admin, state } = fakeDatabase({ callback: original, status: "delivered" });
    await assert.rejects(applyAuthenticatedCallback(admin, input), /CALLBACK_EVENT_ID_CONFLICT/);
    assert.equal(state.updates, 0);
    assert.equal(state.providerCalls, 0);
  }
});

test("conflicting outcome, timestamp or metadata cannot reuse signed event identity", async () => {
  for (const original of [storedCallback({ callback_status: "permanent_failure" }),
    storedCallback({ occurred_at: "2026-10-26T09:58:00.000Z" }),
    storedCallback({ safe_metadata: { sequence: 3, source: "synthetic" } })]) {
    const { admin, state } = fakeDatabase({ callback: original, status: "delivered" });
    await assert.rejects(applyAuthenticatedCallback(admin, input), /CALLBACK_EVENT_ID_CONFLICT/);
    assert.equal(state.updates, 0);
  }
});

test("missing or malformed stored callback fails closed", async () => {
  const missing = fakeDatabase({ forcedDuplicate: true });
  await assert.rejects(applyAuthenticatedCallback(missing.admin, input), /CALLBACK_REPLAY_LOOKUP_FAILED/);
  const invalid = fakeDatabase({ callback: storedCallback({ signature_valid: false }), status: "delivered" });
  await assert.rejects(applyAuthenticatedCallback(invalid.admin, input), /CALLBACK_REPLAY_RECORD_INVALID/);
  assert.equal(missing.state.updates + invalid.state.updates, 0);
});

test("crash after callback INSERT cannot be acknowledged as completed replay", async () => {
  const { admin, state } = fakeDatabase({ failUpdate: true });
  await assert.rejects(applyAuthenticatedCallback(admin, input), /CALLBACK_RECOVERY_REQUIRED/);
  assert.equal(state.inserts, 1);
  assert.equal(state.delivery.delivery_status, "sent");
  state.failUpdate = false;
  await assert.rejects(applyAuthenticatedCallback(admin, input), /CALLBACK_RECOVERY_REQUIRED/);
  assert.equal(state.updates, 0);
  assert.equal(state.providerCalls, 0);
});

test("terminal delivery is not rolled backward by a new callback", async () => {
  for (const status of ["acknowledged", "cancelled", "expired", "terminal_failure", "dead_letter", "unknown_outcome", "delivered"]) {
    const { admin, state } = fakeDatabase({ status });
    const result = await applyAuthenticatedCallback(admin, input);
    assert.equal(result.ignoredTerminal, true, status);
    assert.equal(result.deliveryStatus, status);
    assert.equal(state.delivery.delivery_status, status);
    assert.equal(state.updates, 0);
  }
});

test("acknowledgment advances delivered only while valid; late callback cannot regress it", async () => {
  const valid = fakeDatabase({ status: "delivered" });
  const acknowledged = await applyAuthenticatedCallback(valid.admin, { ...input, outcome: "acknowledged" });
  assert.equal(acknowledged.deliveryStatus, "acknowledged");
  assert.equal(valid.state.updates, 1);
  const late = fakeDatabase({ status: "delivered" });
  const ignored = await applyAuthenticatedCallback(late.admin, { ...input,
    outcome: "acknowledged", now: new Date("2026-10-26T12:00:00.000Z") });
  assert.equal(ignored.ignoredTerminal, true);
  assert.equal(late.state.delivery.delivery_status, "delivered");
  assert.equal(late.state.updates, 0);
});

test("callback update uses status and attempt fencing; stale write requires recovery", async () => {
  const { admin, state } = fakeDatabase({ failUpdate: true });
  await assert.rejects(applyAuthenticatedCallback(admin, input), /CALLBACK_RECOVERY_REQUIRED/);
  const source = readFileSync(new URL("../../lib/domain/digital-observer/notification-delivery-service.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("delivery_status", delivery\.delivery_status\)/);
  assert.match(source, /\.eq\("attempt_count", delivery\.attempt_count\)/);
  assert.equal(state.providerCalls, 0);
});

test("external route verifies the signature before calling the service", () => {
  const route = readFileSync(new URL("../../app/api/digital-observer/provider-callbacks/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql", import.meta.url), "utf8");
  assert(route.indexOf("if (!verification.valid)") < route.indexOf("const result = await applyAuthenticatedCallback"));
  assert.match(route, /CALLBACK_RECOVERY_REQUIRED/);
  assert.match(migration, /unique \(provider_key, provider_event_id\)/);
});
