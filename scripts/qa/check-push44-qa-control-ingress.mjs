import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { request as httpRequest } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { ACCESS_AUDIENCE, ACCESS_ISSUER, ACCESS_OWNER, CONTROL_HOST, CONTROL_PATH,
  createPush44AccessVerifier, createPush44ControlLedger, createPush44QaControlIngress
} from "../../services/video-gateway/push44-qa-control-ingress.mjs";

const now = 1_800_000_000_000;
const deadline = now + 30 * 60_000;
const proxyKey = "k".repeat(43);

async function fixture() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const keySet = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims = {}, header = {}) => new SignJWT({ sub: "approved-owner", email: ACCESS_OWNER, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key", ...header })
    .setIssuer(claims.iss ?? ACCESS_ISSUER)
    .setAudience(claims.aud ?? ACCESS_AUDIENCE)
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(now / 1000) + 600)
    .sign(privateKey);
  return { sign, privateKey, verifyAccess: createPush44AccessVerifier({ keySet, now: () => now }) };
}

function post(url, jwt, { path = CONTROL_PATH, headers = {}, body = "{}" } = {}) {
  const target = new URL(path, url);
  return new Promise((resolve, reject) => {
    const req = httpRequest(target, { method: "POST", headers: {
      host: CONTROL_HOST, origin: `https://${CONTROL_HOST}`, "x-forwarded-proto": "https",
      "cf-access-jwt-assertion": jwt, "content-type": "application/json", ...headers
    } }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("signed Access assertion requires current key, exact issuer/audience/owner and expiry", async () => {
  const { sign, privateKey: approvedKey, verifyAccess } = await fixture();
  assert.equal(await verifyAccess(await sign()), true);
  assert.equal(await verifyAccess("bad.token.value"), false);
  for (const claims of [
    { iss: "https://other.cloudflareaccess.com" },
    { aud: "wrong-application" },
    { email: "other@example.invalid" },
    { sub: "" }
  ]) assert.equal(await verifyAccess(await sign(claims)), false);
  const { privateKey } = await generateKeyPair("RS256");
  const forged = await new SignJWT({ sub: "approved-owner", email: ACCESS_OWNER })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ACCESS_ISSUER).setAudience(ACCESS_AUDIENCE)
    .setIssuedAt(Math.floor(now / 1000)).setExpirationTime(Math.floor(now / 1000) + 600)
    .sign(privateKey);
  assert.equal(await verifyAccess(forged), false);
  const expired = await new SignJWT({ sub: "approved-owner", email: ACCESS_OWNER })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ACCESS_ISSUER).setAudience(ACCESS_AUDIENCE)
    .setIssuedAt(Math.floor(now / 1000) - 1200).setExpirationTime(Math.floor(now / 1000) - 600)
    .sign(approvedKey);
  assert.equal(await verifyAccess(expired), false);
});

test("durable local request ceiling survives restart and cannot reset by changing deadline", () => {
  const directory = mkdtempSync(join(tmpdir(), "push44-ingress-ledger-"));
  const path = join(directory, "limits.sqlite");
  let database = new DatabaseSync(path);
  let clock = now;
  try {
    const first = createPush44ControlLedger(database, deadline, () => clock);
    assert.equal(first.consume(), true);
    database.close();
    database = new DatabaseSync(path);
    const restarted = createPush44ControlLedger(database, deadline, () => clock);
    assert.equal(restarted.stats().attempts, 1);
    assert.equal(restarted.stats().bytes, 10_240);
    assert.equal(createPush44ControlLedger(database, deadline + 1, () => clock).consume(), false);
    for (let i = 1; i < 60; i++) assert.equal(restarted.consume(), true);
    assert.equal(restarted.consume(), false, "same-minute abuse is denied");
    for (let i = 60; i < 1000; i++) {
      clock = now + Math.floor(i / 60) * 60_000;
      assert.equal(restarted.consume(), true);
    }
    assert.equal(restarted.consume(), false);
    assert.equal(restarted.stats().bytes, 1000 * 10_240);
  } finally { database.close(); rmSync(directory, { recursive: true }); }
});

test("loopback control proxy strips caller identity, forwards only exact control API and denies media", async t => {
  const { sign, verifyAccess } = await fixture();
  const jwt = await sign();
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  const calls = [];
  const ingress = createPush44QaControlIngress({ proxyKey, deadline, now: () => now,
    ledger: createPush44ControlLedger(database, deadline), verifyAccess,
    fetcher: async (url, init) => { calls.push({ url, init }); return Response.json({ state: "PENDING" }); }
  });
  const url = await ingress.listen();
  t.after(() => ingress.close());
  const good = await post(url, jwt, { headers: {
    cookie: "CF_Authorization=stolen; sb-development-auth-token.0=synthetic; arbitrary=ignored",
    "cf-connecting-ip": "1.2.3.4"
  } });
  assert.equal(good.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `http://127.0.0.1:3001${CONTROL_PATH}`);
  assert.equal(calls[0].init.headers.cookie, "sb-development-auth-token.0=synthetic");
  assert.equal(calls[0].init.headers["cf-access-jwt-assertion"], undefined);
  assert.equal(calls[0].init.headers["x-forwarded-proto"], "https");
  assert.equal(calls[0].init.headers["x-do-qa-proxy-key"], proxyKey);
  for (const options of [
    { path: "/api/digital-observer/media/playlist.m3u8" },
    { path: "/api/digital-observer/qa-device?replay=1" },
    { headers: { host: "evil.invalid" } },
    { headers: { "x-forwarded-proto": "http" } },
    { headers: { "x-forwarded-host": "evil.invalid" } },
    { headers: { "x-do-qa-proxy-key": "forged" } },
    { headers: { authorization: "Bearer forged" } },
    { body: "x".repeat(2049) }
  ]) assert.notEqual((await post(url, jwt, options)).status, 200);
  assert.equal((await post(url, "forged.jwt.value")).status, 403);
  assert.equal(calls.length, 1);
});

test("one in-flight request and fail-closed accounting stop concurrent or exhausted calls", async t => {
  const { sign, verifyAccess } = await fixture();
  const jwt = await sign();
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const ingress = createPush44QaControlIngress({ proxyKey, deadline, now: () => now,
    ledger: createPush44ControlLedger(database, deadline), verifyAccess,
    fetcher: async () => { entered(); await pending; return Response.json({ ok: true }); }
  });
  const url = await ingress.listen();
  t.after(() => ingress.close());
  const first = post(url, jwt);
  await started;
  assert.equal((await post(url, jwt)).status, 429);
  release();
  assert.equal((await first).status, 200);
  const denied = createPush44QaControlIngress({ proxyKey, deadline, now: () => now,
    ledger: { consume: () => { throw Error("database unavailable"); } },
    verifyAccess, fetcher: async () => Response.json({ ok: true }) });
  const deniedUrl = await denied.listen();
  t.after(() => denied.close());
  assert.equal((await post(deniedUrl, jwt)).status, 503);
});

test("absolute deadline and oversized upstream response deny without returning protected data", async t => {
  const { sign, verifyAccess } = await fixture();
  const jwt = await sign();
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  let clock = now;
  let upstreamCalls = 0;
  const ingress = createPush44QaControlIngress({ proxyKey, deadline, now: () => clock,
    ledger: createPush44ControlLedger(database, deadline), verifyAccess,
    fetcher: async () => { upstreamCalls++; return Response.json({ data: "x".repeat(9000) }); }
  });
  const url = await ingress.listen();
  t.after(() => ingress.close());
  const oversized = await post(url, jwt);
  assert.equal(oversized.status, 403);
  assert.equal(oversized.body.includes("xxxx"), false);
  clock = deadline;
  assert.equal((await post(url, jwt)).status, 410);
  assert.equal(upstreamCalls, 1);
});
