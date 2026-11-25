import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { handlePairSubmission } from "./pair-handler.mjs";

function fixture() {
  const now = 1_000_000;
  const origin = "http://127.0.0.1";
  const path = origin + "/qa/site-source-pair";
  const claims = { actor: randomUUID(), sessionId: randomUUID(), role: "authenticated", exp: 1100,
    emailConfirmed: true, observerActive: true };
  const pin = { actor: claims.actor, sessionId: claims.sessionId, submission: randomUUID(),
    fixtureLabel: "QA synthetic", sourceId: randomUUID(), expiresAtMs: now + 60_000 };
  const body = { submission: pin.submission, fixture_label: pin.fixtureLabel };
  const calls = [];
  const result = { site_id: randomUUID(), source_id: pin.sourceId };
  const deps = { now: () => now, verifyProductSession: async () => claims,
    readOperatorPin: async () => pin, submitPair: async (args) => { calls.push(args); return result; } };
  const post = (fields = body, headers = {}, url = path) => handlePairSubmission(new Request(url, {
    method: "POST", headers: { origin, host: "127.0.0.1", "content-type": "application/json", ...headers }, body: JSON.stringify(fields)
  }), deps);
  return { claims, pin, body, calls, result, deps, post, now };
}

test("only the authenticated subject, verified session and approved submission reach the pair writer", async () => {
  const f = fixture();
  const res = await f.post();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), f.result);
  assert.deepEqual(f.calls, [{ verified_actor: f.claims.actor, verified_session: f.claims.sessionId, token_exp: f.claims.exp,
    submission: f.pin.submission, fixture_label: f.pin.fixtureLabel }]);
  assert.equal(res.headers.get("cache-control"), "no-store");
});
for (const [key, value] of Object.entries({ actor: randomUUID(), sessionId: randomUUID(), submission: randomUUID(),
  fixtureLabel: "different", expiresAtMs: 1_000_000 })) {
  test("mismatched or expired pin rejects before persistence: " + key, async () => {
    const f = fixture(); f.pin[key] = value;
    assert.equal((await f.post()).status, 403); assert.equal(f.calls.length, 0);
  });
}
test("revoked, expired, unconfirmed and inactive identities cannot submit", async () => {
  for (const patch of [null, { exp: 1000 }, { emailConfirmed: false }, { observerActive: false }, { role: "service_role" }]) {
    const f = fixture(); f.deps.verifyProductSession = async () => patch && { ...f.claims, ...patch };
    assert.equal((await f.post()).status, 401); assert.equal(f.calls.length, 0);
  }
});
test("refuses caller-supplied source, owner, oversized input and forwarded or cross-origin requests", async () => {
  const f = fixture();
  for (const patch of [{ source_id: randomUUID() }, { verified_actor: randomUUID() }, { fixture_label: "A".repeat(600) }]) {
    assert.equal((await f.post({ ...f.body, ...patch })).status, 400);
  }
  for (const headers of [{ origin: "https://example.invalid" }, { host: "example.invalid" }, { "x-forwarded-host": "example.invalid" }]) {
    assert.equal((await f.post(f.body, headers)).status, 403);
  }
  assert.equal((await f.post(f.body, {}, "https://example.invalid/qa/site-source-pair")).status, 404);
  assert.equal(f.calls.length, 0);
});
test("mismatched receipt and writer error fail closed without returning diagnostic content", async () => {
  const f = fixture();
  for (const submit of [async () => ({ ...f.result, source_id: randomUUID() }), async () => { throw Error("internal"); }]) {
    f.deps.submitPair = submit;
    const res = await f.post(); assert.equal(res.status, 503); assert.deepEqual(await res.json(), {});
  }
});
test("concurrent requests carry the same submission; the handler never invents a replacement ID", async () => {
  const f = fixture();
  const responses = await Promise.all([f.post(), f.post()]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  assert.deepEqual(f.calls[0], f.calls[1]);
  assert.equal(f.calls[0].submission, f.pin.submission);
});
test("after a lost reply the caller can retry with the original submission", async () => {
  const f = fixture();
  let first;
  f.deps.submitPair = async args => {
    if (first) {
      assert.deepEqual(args, first);
      return f.result;
    }
    first = args;
    throw new Error("reply unavailable");
  };
  assert.equal((await f.post()).status, 503);
  assert.deepEqual(await (await f.post()).json(), f.result);
});
