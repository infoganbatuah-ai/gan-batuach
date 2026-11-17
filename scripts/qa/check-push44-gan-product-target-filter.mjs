import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const rows = [
  { id: "gan", profile_id: "shared", platform: "web", device_token: "gan-token", is_active: true, metadata: { source: "fcm_web" } },
  { id: "observer-web", profile_id: "shared", platform: "web", device_token: "observer-web-token", is_active: true, metadata: { source: "digital_observer_fcm" } },
  { id: "observer-native", profile_id: "shared", platform: "ios", device_token: "observer-native-token", is_active: true, metadata: { source: "digital_observer_native" } },
  { id: "unlabelled", profile_id: "shared", platform: "web", device_token: "legacy-token", is_active: true, metadata: {} },
  { id: "other-profile", profile_id: "other", platform: "web", device_token: "other-token", is_active: true, metadata: { source: "fcm_web" } }
];

function tokenQuery() {
  const filters = [];
  const query = {
    select() { return this; },
    eq(name, value) { filters.push((row) => row[name] === value); return this; },
    contains(name, value) { filters.push((row) => Object.entries(value).every(([key, expected]) => row[name]?.[key] === expected)); return this; },
    order() { return this; },
    limit() { return this; },
    then(resolve) { resolve({ data: rows.filter((row) => filters.every((filter) => filter(row))), error: null }); }
  };
  return query;
}

function load(relative, modules) {
  const source = readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText;
  const fixture = { exports: {} };
  new Function("require", "module", "exports", "process", compiled)(
    (name) => modules[name] ?? require(name), fixture, fixture.exports,
    { env: { GB_M31_EXTERNAL_DELIVERY_ENABLED: "true" } }
  );
  return fixture.exports;
}

test("legacy Gan push preparation selects only its web FCM registration", async () => {
  const sent = [];
  const logs = [];
  const service = load("lib/domain/push-service.ts", {
    "./push-provider": { getPushProviderForPlatform: () => ({
      name: "mock", send: async ({ deviceTokenId }) => {
        sent.push(deviceTokenId);
        return { ok: true, status: "sent_mock", provider: "mock" };
      }
    }) }
  });
  const db = { from(name) {
    if (name === "push_device_tokens") return tokenQuery();
    if (name === "push_notification_logs") return { insert(values) {
      logs.push(...(Array.isArray(values) ? values : [values]));
      return { select: async () => ({ data: logs, error: null }) };
    } };
    return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({
      data: name === "communication_preferences" ? { receive_push: true } : { enabled: true }, error: null
    }) };
  } };
  const result = await service.preparePushForNotification(db, {
    profileId: "shared", title: "Synthetic test", category: "system_notification"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(sent, ["gan"]);
  assert.deepEqual(logs.map((row) => row.device_token_id), ["gan"]);
});

test("Management delivery batch cannot submit Observer or unlabelled tokens", async () => {
  const sent = [];
  const intent = { id: "intent", notification_id: "notification", recipient_profile_id: "shared",
    channel: "push", lease_token: "lease", attempts: 1, dedupe_key: "dedupe" };
  const db = {
    rpc(name) {
      if (name === "claim_management_delivery_intents") return Promise.resolve({ data: [intent], error: null });
      if (name === "management_delivery_recipient_authorized") return Promise.resolve({ data: true, error: null });
      if (name === "finish_management_delivery_intent") return Promise.resolve({ data: true, error: null });
      assert.fail(`unexpected RPC ${name}`);
    },
    from(name) {
      if (name === "push_device_tokens") return tokenQuery();
      const data = name === "notifications"
        ? { id: "notification", recipient_id: "shared", preference_category: "message" }
        : name === "profiles"
          ? { id: "shared", active: true }
          : { receive_push: true, notification_category_channels: { message: ["push"] } };
      return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data, error: null }) };
    }
  };
  const delivery = load("lib/management/external-delivery.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/domain/email-provider": { getEmailProvider: () => ({ checkReadiness: () => ({ canSendRealMessages: false }) }) },
    "@/lib/domain/push-provider": { getPushProviderForPlatform: () => ({
      getReadiness: () => ({ canSendRealMessages: true }),
      send: async ({ deviceTokenId }) => {
        sent.push(deviceTokenId);
        return { ok: true, status: "sent", providerMessageId: "synthetic-ack" };
      }
    }) }
  });
  const result = await delivery.processManagementDeliveryBatch(1);
  assert.equal(result.completed, 1);
  assert.deepEqual(sent, ["gan"]);
});
