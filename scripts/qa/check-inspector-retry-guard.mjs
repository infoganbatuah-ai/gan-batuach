import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { boundedCleanup, createRequestGuard, persistReceipt, requestCategory, REQUEST_LIMIT, TARGET_PATH, withinDeadline } from "./inspector-retry-guard.mjs";

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
  const folder = mkdtempSync(join(tmpdir(), "gb-inspector-retry-"));
  const path = join(folder, "receipt.json");
  const digest = persistReceipt(path, { status: "DIAGNOSTIC_INCONCLUSIVE", failure: { kind: failure.name } });
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).status, "DIAGNOSTIC_INCONCLUSIVE");
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test("cleanup timeout is bounded and explicit", async () => {
  await assert.rejects(boundedCleanup(() => new Promise(() => {}), 5), /DIAGNOSTIC_DEADLINE/);
});
