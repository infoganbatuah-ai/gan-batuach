import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function loadService(send) {
  const fixtureModule = { exports: {} };
  const localRequire = (name) => name === "./push-provider"
    ? { getPushProviderForPlatform: () => ({ name: "mock_push", send }) }
    : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}

function client() {
  const logs = [];
  const results = {
    communication_preferences: { data: { receive_push: true }, error: null },
    push_category_preferences: { data: { enabled: true }, error: null },
    push_device_tokens: { data: [
      { id: "device-1", platform: "web", device_token: "token-1", metadata: { source: "fcm_web" } },
      { id: "device-2", platform: "web", device_token: "token-2", metadata: { source: "fcm_web" } }
    ], error: null }
  };
  return {
    logs,
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        contains() { return this; },
        maybeSingle() { return Promise.resolve(results[table]); },
        insert(rows) {
          logs.push(...(Array.isArray(rows) ? rows : [rows]));
          return { select() { return Promise.resolve({ data: logs.map((row) => ({ ...row, id: row.device_token_id })), error: null }); } };
        },
        then(resolve, reject) { return Promise.resolve(results[table]).then(resolve, reject); }
      };
    }
  };
}

const input = { profileId: "profile-1", title: "Check", category: "system_notification" };

test("one provider rejection records an unknown outcome without losing another token result", async () => {
  const service = loadService(async ({ deviceTokenId }) => {
    if (deviceTokenId === "device-1") throw new Error("response lost after submission");
    return { ok: true, status: "sent_mock", provider: "mock_push", providerMessageId: "accepted-2" };
  });
  const db = client();
  const result = await service.preparePushForNotification(db, input);
  assert.equal(result.ok, true);
  assert.equal(db.logs.length, 2);
  assert.equal(db.logs[0].status, "failed");
  assert.equal(db.logs[0].failure_reason, "provider_submission_outcome_unknown");
  assert.equal(db.logs[0].next_retry_at, null);
  assert.equal(db.logs[1].status, "sent_mock");
  assert.equal(db.logs[1].provider_message_id, "accepted-2");
});

test("explicit provider failure retains its existing retry schedule", async () => {
  const service = loadService(async () => ({ ok: false, status: "failed", provider: "mock_push", failureReason: "rejected" }));
  const db = client();
  const result = await service.preparePushForNotification(db, input);
  assert.equal(result.ok, true);
  assert.equal(db.logs.length, 2);
  assert.ok(db.logs.every((row) => row.failure_reason === "rejected" && row.next_retry_at));
});
