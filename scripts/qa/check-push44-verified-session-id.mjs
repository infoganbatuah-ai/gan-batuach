import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveQaVerifiedSession } from "../../lib/domain/digital-observer/qa-verified-session.ts";

const accountId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const tokenFor = (claims = {}) => `a.${Buffer.from(JSON.stringify({ sub: accountId,
  session_id: sessionId, exp: 2_000, ...claims })).toString("base64url")}.signature`;
const request = (token) => new Request("https://qa-iphone-device-proof.ganbatuach.com/", {
  headers: token ? { authorization: `Bearer ${token}` } : {}
});
const authorized = (token, userId = accountId) => async () => ({ user: { id: userId }, accessToken: token });

test("verified bearer, live canonical Auth result, and matching JWT session return identity", async () => {
  const token = tokenFor();
  assert.deepEqual(await resolveQaVerifiedSession(request(token), authorized(token), () => 1_000_000),
    { accountId, sessionId });
});

for (const [name, token, auth, time] of [
  ["missing bearer", null, async () => { throw new Error("must not call"); }, 1_000_000],
  ["revoked session", tokenFor(), async () => null, 1_000_000],
  ["Auth unavailable", tokenFor(), async () => { throw new Error("offline"); }, 1_000_000],
  ["cross-account", tokenFor(), authorized(tokenFor(), "33333333-3333-4333-8333-333333333333"), 1_000_000],
  ["expired token", tokenFor({ exp: 999 }), authorized(tokenFor({ exp: 999 })), 1_000_000],
  ["missing session ID", tokenFor({ session_id: null }), authorized(tokenFor({ session_id: null })), 1_000_000],
  ["invalid session ID", tokenFor({ session_id: "not-uuid" }), authorized(tokenFor({ session_id: "not-uuid" })), 1_000_000],
  ["different verified bearer", tokenFor(), authorized("different"), 1_000_000],
  ["malformed JWT", "bad-token", authorized("bad-token"), 1_000_000]
]) test(`${name} fails closed`, async () => {
  assert.equal(await resolveQaVerifiedSession(request(token), auth, () => time), null);
});
