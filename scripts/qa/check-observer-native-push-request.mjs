import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const source = readFileSync(new URL("lib/domain/digital-observer/native-push-request.ts", root), "utf8");
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
const exports = {};
vm.runInNewContext(compiled.outputText, { exports }, { timeout: 1000 });
const { parseNativePushRequest, nativePushResult } = exports;

test("native result preserves exact request and Site correlation", () => {
  const request = parseNativePushRequest({ requestId: "request-a", siteId: "site-a" }, ["site-a"]);
  assert.deepEqual(JSON.parse(JSON.stringify(request)), { requestId: "request-a", siteId: "site-a" });
  assert.deepEqual(JSON.parse(JSON.stringify(nativePushResult(request, true))),
    { requestId: "request-a", siteId: "site-a", ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(nativePushResult(request, false, "permission_denied"))),
    { requestId: "request-a", siteId: "site-a", ok: false, reason: "permission_denied" });
});

test("malformed, wrong-Site and missing request identities are rejected", () => {
  for (const detail of [null, {}, { requestId: "", siteId: "site-a" },
    { requestId: "x".repeat(129), siteId: "site-a" }, { requestId: "request-a", siteId: "site-b" },
    { requestId: 1, siteId: "site-a" }]) {
    assert.equal(parseNativePushRequest(detail, ["site-a"]), null);
  }
});

test("runtime emits correlated outcomes and never silently selects the first Site", () => {
  const runtime = readFileSync(new URL("components/digital-observer/observer-mobile-runtime.tsx", root), "utf8");
  const ui = readFileSync(new URL("components/digital-observer/observer-fcm-push-registration.tsx", root), "utf8");
  assert.match(runtime, /parseNativePushRequest\(detail, sites\.map/);
  assert.match(runtime, /nativePushResult\(request, true\)/);
  assert.match(runtime, /nativePushResult\(request, false, "permission_denied"\)/);
  assert.doesNotMatch(runtime, /pendingPushSiteId|sites\[0\]\?\.id/);
  assert.match(ui, /result\.requestId !== requestId \|\| result\.siteId !== siteId/);
});
