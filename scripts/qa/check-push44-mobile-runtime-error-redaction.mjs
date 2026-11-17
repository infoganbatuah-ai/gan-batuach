import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../", import.meta.url);
const source = readFileSync(new URL("lib/api.ts", root), "utf8");
const route = readFileSync(new URL("app/api/digital-observer/mobile/runtime/route.ts", root), "utf8");
const compile = (text) => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

test("malformed native-link JSON cannot echo or log its body through the POST error gate", () => {
  const messages = [];
  const exports = {};
  vm.runInNewContext(compile(source), {
    exports,
    process: { env: { NODE_ENV: "development" } },
    console: { error: (...args) => messages.push(args) },
    require: (id) => id === "next/server" ?
      { NextResponse: { json: (body, options) => ({ body, status: options.status }) } } : require(id)
  }, { timeout: 5000 });

  const marker = "qa_marker";
  let error;
  try { JSON.parse(`{"url":${marker}}`); } catch (caught) { error = caught; }
  assert.ok(error instanceof SyntaxError);
  assert.match(error.message, new RegExp(marker));
  const response = exports.handleSafeRouteError(error);
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(marker));
  assert.doesNotMatch(JSON.stringify(messages), new RegExp(marker));
  assert.match(route, /export async function POST[\s\S]*try \{ body = await request\.json\(\); \} catch \{ return fail\("מבנה הבקשה אינו תקין\.\", 400\); \}/);
  assert.match(route, /export async function POST[\s\S]*return handleSafeRouteError\(error\)/);
  assert.match(route, /link = parseMobileLink\(payload\.url, configuredOrigins\(request\)\)/);
  assert.match(route, /destination: authorizedMobileDestination\(link\)/);
});

test("real mobile POST returns redacted 400 for malformed JSON, 401 before parsing, and 200 for a valid link", async () => {
  const messages = [];
  const api = {};
  const responseFactory = { NextResponse: { json: (body, options) => ({ body, status: options.status }) } };
  vm.runInNewContext(compile(source), {
    exports: api,
    process: { env: { NODE_ENV: "development" } },
    console: { error: (...args) => messages.push(args) },
    require: (id) => id === "next/server" ? responseFactory : require(id)
  }, { timeout: 5000 });
  const runtime = await import(new URL("lib/domain/digital-observer/mobile-runtime.ts", root));
  const handler = {};
  let authorized = true;
  const site = "00000000-0000-4000-8000-000000000045";
  vm.runInNewContext(compile(route), {
    exports: handler,
    process: { env: {} },
    URL,
    require: (id) => id === "@/lib/api" ? api :
      id === "@/lib/domain/digital-observer/access" ? {
        getDigitalObserverApiUser: async () => authorized ? { profile: { id: "qa-user" }, supabase: {} } : null,
        getObserverSiteAccess: async (_db, _profile, siteId) => siteId === site ? { id: site } : null
      } : id === "@/lib/domain/digital-observer/mobile-runtime" ? runtime : require(id)
  }, { timeout: 5000 });
  const request = (body) => new Request("https://local.invalid/api/digital-observer/mobile/runtime", {
    method: "POST", headers: { "content-type": "application/json" }, body
  });
  const marker = "qa_marker";
  const malformed = await handler.POST(request(`{"url":${marker}}`));
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(JSON.stringify(malformed.body), /qa_marker/);
  assert.doesNotMatch(JSON.stringify(messages), /qa_marker/);
  authorized = false;
  assert.equal((await handler.POST(request(`{"url":${marker}}`))).status, 401);
  authorized = true;
  const validUrl = `observerqaapp://investigation?site=${site}`;
  const valid = await handler.POST(request(JSON.stringify({ url: validUrl })));
  assert.equal(valid.status, 200);
  assert.equal(valid.body.data.authorized, true);
  assert.equal(valid.body.data.kind, "investigation");
});
