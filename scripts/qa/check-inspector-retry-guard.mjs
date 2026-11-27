import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { boundedCleanup, createRequestGuard, persistReceipt, requestCategory, REQUEST_LIMIT, sanitizeError, sanitizeInitiator, TARGET_PATH, withinDeadline } from "./inspector-retry-guard.mjs";

const origin = "http://127.0.0.1:3000";
function fakeRoute(kind = "document", path = TARGET_PATH) {
  const record = { continued: 0, aborted: 0 };
  const request = {
    url: () => `${origin}${path}`,
    headers: () => kind === "rsc" ? { rsc: "1" } : {},
    resourceType: () => kind,
    frame: () => ({ url: () => `${origin}/dashboard/inspector` }),
    isNavigationRequest: () => kind === "document",
    redirectedFrom: () => null,
  };
  return { record, request: () => request, continue: async () => { record.continued++; }, abort: async () => { record.aborted++; } };
}

test("six target document/RSC requests are allowed and the seventh is blocked before network", async () => {
  let limitCalls = 0;
  const guard = createRequestGuard({ origin, onLimit: () => limitCalls++ });
  const routes = Array.from({ length: REQUEST_LIMIT + 1 }, (_, index) => fakeRoute(index % 2 ? "rsc" : "document"));
  for (const route of routes) await guard.route(route);
  assert.equal(routes.slice(0, 6).every((route) => route.record.continued === 1 && route.record.aborted === 0), true);
  assert.deepEqual(routes[6].record, { continued: 0, aborted: 1 });
  assert.equal(guard.limited, true);
  assert.equal(limitCalls, 1);
  assert.equal(guard.attempts.at(-1).disposition, "blocked");
});

test("only exact target documents or RSC count; sensitive URLs are not stored", async () => {
  const guard = createRequestGuard({ origin });
  await guard.route(fakeRoute("script"));
  await guard.route(fakeRoute("document", `${TARGET_PATH}/another`));
  await guard.route(fakeRoute("document", `${TARGET_PATH}?private=secret`));
  assert.equal(guard.attempts.length, 1);
  assert.equal(JSON.stringify(guard.attempts).includes("secret"), false);
  assert.equal(requestCategory(fakeRoute("document").request(), origin)?.initiator, "other-app-route");
});

test("deadline rejects, calls timeout hook and leaves a failure receipt", async () => {
  let fired = 0;
  let failure;
  try { await withinDeadline(() => new Promise(() => {}), 5, () => fired++); }
  catch (error) { failure = error; }
  assert.match(failure.message, /DIAGNOSTIC_DEADLINE/);
  assert.equal(fired, 1);
  const folder = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), ".gb-inspector-retry-test-"));
  try {
    const path = join(folder, "receipt.json");
    const digest = persistReceipt(path, { status: "DIAGNOSTIC_INCONCLUSIVE", failure: { kind: failure.name } });
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).status, "DIAGNOSTIC_INCONCLUSIVE");
    assert.equal(statSync(path).mode & 0o777, 0o600);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("cleanup timeout is bounded and explicit", async () => {
  await assert.rejects(boundedCleanup(() => new Promise(() => {}), 5), /DIAGNOSTIC_DEADLINE/);
});

test("first error keeps useful frames while omitting secrets and untrusted message", () => {
  const secret = "eyJhbGciOiJIUzI1NiJ9.private.signature";
  const error = {
    name: "TypeError", message: `user@example.com ${secret} Cannot read properties of undefined`,
    stack: `TypeError: user@example.com ${secret}\n    at renderDue (http://127.0.0.1:3000/_next/static/chunks/app/dashboard/inspector/page.js?token=${secret}:12:34)\n    at user@example.com (file:///Users/private/Projects/Gan-Batuach/components/inspector-app-ui.tsx:56:7)`,
  };
  const safe = sanitizeError(error);
  assert.equal(safe.name, "TypeError");
  assert.equal(safe.category, "PROPERTY_ACCESS_ERROR");
  assert.equal(safe.message, "OMITTED_UNTRUSTED");
  assert.deepEqual(safe.frames.map(({ function: fn, module }) => [fn, module]), [["renderDue", "_next/static/chunks/app/dashboard/inspector/page.js"], ["<anonymous>", "components/inspector-app-ui.tsx"]]);
  assert.equal(JSON.stringify(safe).includes(secret), false);
  assert.equal(JSON.stringify(safe).includes("user@example.com"), false);
  assert.equal(JSON.stringify(safe).includes("/Users/private"), false);
});

test("CDP initiator keeps bounded normalized frames without URL payloads", () => {
  const initiator = sanitizeInitiator({ type: "script", stack: { callFrames: [{ functionName: "navigate", url: "http://127.0.0.1:3000/_next/static/chunks/router.js?email=user@example.com", lineNumber: 44, columnNumber: 2 }] } });
  assert.deepEqual(initiator, { type: "script", frames: [{ function: "navigate", module: "_next/static/chunks/router.js", line: 44, column: 2 }] });
  assert.equal(JSON.stringify(initiator).includes("user@example.com"), false);
});
