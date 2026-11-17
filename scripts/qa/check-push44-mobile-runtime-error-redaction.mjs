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

test("malformed native-link JSON cannot echo or log its body through the POST error gate", () => {
  const messages = [];
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  vm.runInNewContext(compiled, {
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
  assert.match(route, /export async function POST[\s\S]*return handleSafeRouteError\(error\)/);
  assert.match(route, /link = parseMobileLink\(payload\.url, configuredOrigins\(request\)\)/);
  assert.match(route, /destination: authorizedMobileDestination\(link\)/);
});
