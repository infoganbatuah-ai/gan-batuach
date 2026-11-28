import assert from "node:assert/strict";
import { test } from "node:test";
import { handleQaHandoff } from "../../review-only/push44-qa-device-proof/handoff-http-gate.mjs";

const endpoint = "https://qa-iphone-device-proof.ganbatuach.com/api/digital-observer/qa-device-proof/handoff";
const body = { challengeId: "11111111-1111-4111-8111-111111111111",
  installationId: "22222222-2222-4222-8222-222222222222", signatureBase64: "YQ==" };
const request = (payload = body, url = endpoint) => new Request(url, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
});
const deps = () => {
  const calls = { attempts: 0, auth: 0, consume: 0 };
  return { calls, reserveAttempt: async () => { calls.attempts++; return true; },
    authenticate: async () => { calls.auth++; return { accountId: "account-a", sessionId: "session-a" }; },
    consume: async () => { calls.consume++; return true; }, now: () => 1_000 };
};

test("default-off gate rejects before touching Auth or storage", async () => {
  const d = deps();
  assert.equal((await handleQaHandoff(request(), d)).status, 404);
  assert.deepEqual(d.calls, { attempts: 0, auth: 0, consume: 0 });
});

test("enabled isolated adapter binds only server identity and returns no credential", async () => {
  const d = deps();
  let audience;
  const response = await handleQaHandoff(request(), { ...d, enabled: true,
    consume: async (input) => { d.calls.consume++; audience = input.audience; return true; } });
  assert.equal(response.status, 204);
  assert.equal(audience, "com.digitalobserver.app.qa");
  assert.deepEqual(d.calls, { attempts: 1, auth: 1, consume: 1 });
  assert.equal(response.headers.get("location"), null);
  assert.equal(await response.text(), "");
});

for (const [name, req] of [
  ["URL token", request(body, endpoint + "?access_token=secret")],
  ["client account", request({ ...body, accountId: "other" })],
  ["client session", request({ ...body, sessionId: "other" })],
  ["extra key", request({ ...body, bearer: "secret" })],
  ["oversize body", request({ ...body, padding: "x".repeat(3000) })],
  ["wrong path", request(body, endpoint + "/other")]
]) test(`${name} rejected before storage`, async () => {
  const d = deps();
  const response = await handleQaHandoff(req, { ...d, enabled: true });
  assert.notEqual(response.status, 204);
  assert.equal(d.calls.attempts, 1);
  assert.equal(d.calls.consume, 0);
});

for (const [name, reserveAttempt] of [
  ["missing counter", undefined],
  ["counter exhausted", async () => false],
  ["counter unavailable", async () => { throw new Error("offline"); }],
  ["non-affirmative counter", async () => undefined]
]) test(`${name} denies before Auth and body handling`, async () => {
  const d = deps();
  const response = await handleQaHandoff(request(), { ...d, reserveAttempt, enabled: true });
  assert.notEqual(response.status, 204);
  assert.equal(d.calls.auth, 0);
  assert.equal(d.calls.consume, 0);
});

for (const [name, authenticate, consume] of [
  ["revoked session", async () => null, async () => true],
  ["Auth unavailable", async () => { throw new Error("offline"); }, async () => true],
  ["receipt denied or replayed", async () => ({ accountId: "a", sessionId: "s" }), async () => false],
  ["storage unavailable", async () => ({ accountId: "a", sessionId: "s" }), async () => { throw new Error("offline"); }]
]) test(`${name} fails closed`, async () => {
  const response = await handleQaHandoff(request(), {
    enabled: true, reserveAttempt: async () => true, authenticate, consume, now: () => 1_000
  });
  assert.notEqual(response.status, 204);
});
