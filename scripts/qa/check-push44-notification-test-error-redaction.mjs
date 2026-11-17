import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../", import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function apiWithCapturedLogs() {
  const messages = [];
  const exports = {};
  vm.runInNewContext(compile("lib/api.ts"), {
    exports, process: { env: { NODE_ENV: "development" } },
    console: { error: (...args) => messages.push(args) },
    require: (id) => id === "next/server" ?
      { NextResponse: { json: (body, options) => ({ body, status: options.status }) } } : require(id)
  }, { timeout: 5000 });
  return { api: exports, messages };
}

for (const path of [
  "app/api/digital-observer/notifications/push-test/route.ts",
  "app/api/digital-observer/notifications/mock/route.ts"
]) test(`${path} redacts malformed caller JSON after authorization`, async () => {
  const { api, messages } = apiWithCapturedLogs();
  const route = {};
  let authorized = true;
  const source = readFileSync(new URL(path, root), "utf8");
  vm.runInNewContext(compile(path), {
    exports: route,
    require: (id) => {
      if (id === "@/lib/api") return api;
      if (id === "@/lib/domain/digital-observer/access") return {
        getDigitalObserverApiUser: async () => authorized ? { profile: { id: "synthetic-user" }, supabase: {} } : null,
        getObserverSiteAccess: async () => { throw new Error("SHOULD_NOT_REACH_DB"); }
      };
      if (id.startsWith("@/")) return {};
      return require(id);
    }
  }, { timeout: 5000 });

  const marker = "qa_marker";
  const malformed = new Request("https://local.invalid/qa", {
    method: "POST", headers: { "content-type": "application/json" },
    body: `{"observer_site_id":${marker}}`
  });
  const response = await route.POST(malformed);
  assert.equal(response.status, 400);
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(marker));
  assert.doesNotMatch(JSON.stringify(messages), new RegExp(marker));
  const badShape = await route.POST(new Request("https://local.invalid/qa", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}"
  }));
  assert.equal(badShape.status, 422);
  authorized = false;
  const denied = await route.POST(new Request("https://local.invalid/qa", {
    method: "POST", headers: { "content-type": "application/json" }, body: `{"observer_site_id":${marker}}`
  }));
  assert.equal(denied.status, 401);
  assert.match(source, /getDigitalObserverApiUser\(request\)[\s\S]*request\.json\(\)/);
  assert.match(source, /return handleSafeRouteError\(error\)/);
  assert.match(source, /try \{ body = await request\.json\(\); \} catch \{ return fail\("מבנה הבקשה אינו תקין\.\", 400\); \}/);
  if (path.includes("push-test")) assert.match(source, /error\.message\.startsWith\("DELIVERY_"\)\) return fail\(error\.message, 409\)/);
});
