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

function client({ communication = { data: { receive_push: true }, error: null },
  category = { data: { enabled: true }, error: null } } = {}) {
  const logs = [];
  const queried = [];
  const results = {
    communication_preferences: communication,
    push_category_preferences: category,
    push_device_tokens: { data: [{ id: "device-1", platform: "web", device_token: "token", metadata: { source: "fcm_web" } }], error: null }
  };
  return {
    logs,
    queried,
    from(table) {
      queried.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        contains() { return this; },
        maybeSingle() { return Promise.resolve(results[table]); },
        insert(row) {
          logs.push(row);
          return {
            select() { return Promise.resolve({ data: Array.isArray(row) ? row : [row], error: null }); },
            then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); }
          };
        },
        then(resolve, reject) { return Promise.resolve(results[table]).then(resolve, reject); }
      };
    }
  };
}

const input = { profileId: "profile-1", title: "Check", category: "system_notification" };

test("communication preference read failure stops before token lookup or provider", async () => {
  let sends = 0;
  const service = loadService(async () => { sends++; return { status: "sent_mock", provider: "mock_push" }; });
  const db = client({ communication: { data: null, error: { message: "preference lookup failed" } } });
  const result = await service.preparePushForNotification(db, input);
  assert.equal(result.ok, false);
  assert.equal(result.error, "preference lookup failed");
  assert.equal(sends, 0);
  assert.ok(!db.queried.includes("push_device_tokens"));
  assert.equal(db.logs[0].status, "failed");
});

test("category preference read failure cannot be overridden by critical flag", async () => {
  let sends = 0;
  const service = loadService(async () => { sends++; return { status: "sent_mock", provider: "mock_push" }; });
  const db = client({ category: { data: null, error: { message: "category lookup failed" } } });
  const result = await service.preparePushForNotification(db, { ...input, critical: true });
  assert.equal(result.ok, false);
  assert.equal(sends, 0);
  assert.ok(!db.queried.includes("push_device_tokens"));
});

test("known allowed preferences preserve the existing Gan send path", async () => {
  let sends = 0;
  const service = loadService(async () => {
    sends++;
    return { status: "sent_mock", provider: "mock_push", ok: true };
  });
  const db = client();
  await service.preparePushForNotification(db, input);
  assert.equal(sends, 1);
  assert.ok(db.queried.includes("push_device_tokens"));
});
