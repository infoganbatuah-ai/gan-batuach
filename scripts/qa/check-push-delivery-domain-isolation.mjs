import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sent = [];
const pushProvider = {
  name: "synthetic",
  getReadiness: () => ({ canSendRealMessages: true }),
  send: async (input) => {
    sent.push(input);
    return { ok: true, status: "sent", provider: "synthetic", providerMessageId: `synthetic-${sent.length}` };
  }
};

function load(file, dependencies) {
  const loadedModule = { exports: {} };
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(output, {
    module: loadedModule, exports: loadedModule.exports, Date, Intl, Object, Promise, process: { env: { GB_M31_EXTERNAL_DELIVERY_ENABLED: "true" } },
    require: (id) => {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    }
  }, { filename: file });
  return loadedModule.exports;
}

const push = load("lib/domain/push-service.ts", {
  crypto: require("node:crypto"), "./push-provider": { getPushProviderForPlatform: () => pushProvider }
});
const garden = "garden-a";
const profile = "shared-profile";
const token = (id, metadata, lastSeen = 0) => ({ id, profile_id: profile, platform: "web", device_token: `synthetic-${id}`,
  is_active: true, metadata, last_seen_at: lastSeen });
const management = (id = "management", lastSeen = 0) => token(id, { source: "fcm_web" }, lastSeen);
const observer = (id, siteId, lastSeen = 0) => token(id, { source: "digital_observer_fcm", observer_site_id: siteId }, lastSeen);

function database(tokens, options = {}) {
  const calls = [];
  const notification = { id: "notification-1", recipient_id: profile, preference_category: "enrollment",
    source_domain: Object.hasOwn(options, "sourceDomain") ? options.sourceDomain : "enrollment", garden_id: garden };
  const rows = {
    push_device_tokens: tokens,
    notifications: [notification],
    profiles: [{ id: profile, active: true, email: null, phone: null }],
    communication_preferences: [{ profile_id: profile, receive_push: true,
      notification_category_channels: { enrollment: ["push"] }, parent_category_channels: {} }],
    push_category_preferences: [], push_templates: [], push_notification_logs: []
  };
  function query(table, operation = "read", payload = null) {
    const filters = [];
    let maximum = Infinity;
    let sort = null;
    const builder = {
      select() { return builder; },
      eq(column, value) { calls.push([table, "eq", column, value]); filters.push((row) => row[column] === value); return builder; },
      contains(column, value) { calls.push([table, "contains", column, value]); filters.push((row) =>
        Object.entries(value).every(([key, expected]) => row[column]?.[key] === expected)); return builder; },
      is(column, value) {
        calls.push([table, "is", column, value]);
        assert.equal(value, null);
        assert.equal(column, "metadata->observer_site_id");
        filters.push((row) => !Object.hasOwn(row.metadata ?? {}, "observer_site_id"));
        return builder;
      },
      order(column, { ascending }) { calls.push([table, "order", column]); sort = [column, ascending]; return builder; },
      limit(value) { calls.push([table, "limit", value]); maximum = value; return builder; },
      then(resolve, reject) { return Promise.resolve(finish()).then(resolve, reject); },
      maybeSingle: async () => { const result = finish(); return { ...result, data: result.data?.[0] ?? null }; },
      single: async () => { const result = finish(); return { ...result, data: result.data?.[0] ?? null }; }
    };
    function finish() {
      if (table === "push_device_tokens" && options.tokenError) return { data: null, error: { message: "lookup unavailable" } };
      if (operation === "insert") {
        const inserted = (Array.isArray(payload) ? payload : [payload]).map((row, index) => ({ id: `log-${index}`, ...row }));
        rows[table].push(...inserted);
        return { data: inserted, error: null };
      }
      const source = rows[table];
      assert.ok(source, `Unexpected table: ${table}`);
      let data = source.filter((row) => filters.every((filter) => filter(row)));
      if (sort) data = [...data].sort((a, b) => (a[sort[0]] - b[sort[0]]) * (sort[1] ? 1 : -1));
      return { data: data.slice(0, maximum), error: null };
    }
    return builder;
  }
  return { calls, rows, from(table) { return {
    select: () => query(table), insert: (payload) => query(table, "insert", payload),
    update: () => { throw new Error("No token update is expected in this test"); }
  }; }, rpc: async (name) => {
    if (name === "claim_management_delivery_intents") return { data: [{ id: "intent-1", notification_id: notification.id,
      recipient_profile_id: profile, channel: "push", lease_token: "lease-1", attempts: 1, dedupe_key: "dedupe-1" }], error: null };
    if (name === "management_delivery_recipient_authorized" || name === "finish_management_delivery_intent") {
      return { data: true, error: null };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  } };
}

let currentDb;
const delivery = load("lib/management/external-delivery.ts", {
  "@/lib/supabase/admin": { createAdminClient: () => currentDb },
  "@/lib/domain/email-provider": { getEmailProvider: () => { throw new Error("Email provider must not be called"); } },
  "@/lib/domain/push-provider": { getPushProviderForPlatform: () => pushProvider },
  "@/lib/domain/push-service": push
});

test("Management delivery filters source and absent Observer Site before the first 20 tokens", async () => {
  sent.length = 0;
  currentDb = database([
    ...Array.from({ length: 25 }, (_, index) => observer(`observer-${index}`, `site-${index % 2}`, 100 - index)),
    token("ambiguous-site", { source: "fcm_web", observer_site_id: "site-a" }, 90),
    token("legacy", {}, 80), management("management-one", 1)
  ]);
  const result = await delivery.processManagementDeliveryBatch();
  assert.equal(result.completed, 1);
  assert.deepEqual(sent.map((item) => item.deviceTokenId), ["management-one"]);
  const tokenCalls = currentDb.calls.filter(([table]) => table === "push_device_tokens");
  assert.ok(tokenCalls.findIndex(([, method]) => method === "contains") < tokenCalls.findIndex(([, method]) => method === "limit"));
  assert.ok(tokenCalls.findIndex(([, method]) => method === "is") < tokenCalls.findIndex(([, method]) => method === "limit"));
});

test("Management delivery rejects missing or ambiguous notification source and legacy tokens", async () => {
  for (const sourceDomain of ["system", "digital_observer", null]) {
    sent.length = 0;
    currentDb = database([management()], { sourceDomain });
    await delivery.processManagementDeliveryBatch();
    assert.equal(sent.length, 0);
    assert.equal(currentDb.calls.filter(([table]) => table === "push_device_tokens").length, 0);
  }
  sent.length = 0;
  currentDb = database([observer("observer", "site-a"), token("legacy", null)]);
  await delivery.processManagementDeliveryBatch();
  assert.equal(sent.length, 0);
});

test("direct Management Push helper never sends to Observer or ambiguous same-profile tokens", async () => {
  sent.length = 0;
  const db = database([observer("observer-a", "site-a"), observer("observer-b", "site-b"),
    token("wrong-site-label", { source: "fcm_web", observer_site_id: "site-a" }), token("legacy", {}), management()]);
  const result = await push.preparePushForNotification(db, { profileId: profile, notificationId: "notification-1",
    title: "Synthetic Management notice" });
  assert.equal(result.ok, true);
  assert.deepEqual(sent.map((item) => item.deviceTokenId), ["management"]);
  assert.equal(db.rows.push_notification_logs.length, 1);
});

test("lookup failure or ambiguous returned metadata fails closed before provider submission", async () => {
  sent.length = 0;
  const failure = await push.preparePushForNotification(database([management()], { tokenError: true }),
    { profileId: profile, title: "Synthetic Management notice" });
  assert.equal(failure.ok, false);
  assert.equal(sent.length, 0);
  const unexpected = database([management()]);
  const originalFrom = unexpected.from;
  unexpected.from = (table) => table === "push_device_tokens" ? {
    select: () => ({ eq() { return this; }, contains() { return this; }, is() { return this; },
      then(resolve) { return Promise.resolve({ data: [observer("unexpected", "wrong-site")], error: null }).then(resolve); } })
  } : originalFrom(table);
  const denied = await push.preparePushForNotification(unexpected, { profileId: profile, title: "Synthetic Management notice" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "PUSH_TOKEN_SOURCE_UNVERIFIED");
  assert.equal(sent.length, 0);
});

test("Observer delivery does not call these legacy Management token selectors", () => {
  const observerService = readFileSync("lib/domain/digital-observer/notification-delivery-service.ts", "utf8");
  assert.doesNotMatch(observerService, /push_device_tokens|preparePushForNotification|processManagementDeliveryBatch/);
  const callers = ["app/api/garden/children/[id]/status/route.ts", "app/api/garden/leads/[id]/convert/route.ts"];
  for (const file of callers) assert.match(readFileSync(file, "utf8"), /preparePushForNotification\(/);
});
