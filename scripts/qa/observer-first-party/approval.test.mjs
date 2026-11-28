import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import test from "node:test";
import { createQaProxy, observerOriginRedirect } from "../push44-owner-qa-proxy.mjs";
import { OBSERVER_QA_HOST as host } from "../push44-observer-qa-ingress-policy.mjs";

const code = "abba0102ffee0304"; // Synthetic fixture.
const approve = "/__push44/owner-approval";
async function fixture(t, upstream, mediaOptions) {
  let time = 1_000;
  const proxy = createQaProxy({ qaHost: host, upstream, approvalCode: code, now: () => time, ...mediaOptions });
  await new Promise((resolve, reject) => proxy.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => { proxy.closeAllConnections(); proxy.close(); });
  function send(method, path, body, extra = {}) {
    const headers = { host, origin: "https://" + host, "x-forwarded-proto": "https",
      "content-type": "application/x-www-form-urlencoded", ...extra };
    return new Promise((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", port: proxy.address().port, method, path, headers }, res => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", part => { text += part; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
      });
      req.on("error", reject);
      req.end(body);
    });
  }
  return {send, redeem: () => send("POST", approve, "approval=" + code), advance: ms => { time += ms; }};
}

test("single-use redemption under concurrent submissions, replay and deadline", async t => {
  const f = await fixture(t);
  const results = await Promise.all([f.redeem(), f.redeem()]);
  assert.deepEqual(results.map(r => r.status).sort(), [303, 403]);
  const winner = results.find(r => r.status === 303);
  const cookie = winner.headers["set-cookie"][0];
  assert.match(cookie, /^__Host-observer_qa_window=[0-9a-f]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict;/);
  assert.ok(!cookie.includes(code));
  assert.equal(winner.headers.location, "/digital-observer/login");
  const replay = await f.redeem();
  assert.equal(replay.status, 403);
  assert.equal(replay.headers["set-cookie"], undefined);
  f.advance(30 * 60_000);
  assert.equal((await f.send("GET", "/digital-observer/dashboard", undefined, {cookie: cookie.split(";")[0]})).status, 410);
});

test("approval expires at two minutes without issuing any cookie", async t => {
  const f = await fixture(t);
  f.advance(120_000);
  const expired = await f.redeem();
  assert.equal(expired.status, 403);
  assert.equal(expired.headers["set-cookie"], undefined);
});

test("missing approval, wrong origin, URL tokens and excessive guesses fail closed", async t => {
  const f = await fixture(t);
  assert.equal((await f.send("GET", "/digital-observer/dashboard")).status, 403);
  assert.equal((await f.send("GET", "/__push44/bootstrap?t=" + code)).status, 403);
  assert.equal((await f.send("POST", approve, "approval=" + code, {origin:"https://another.invalid"})).status, 403);
  for (let i = 0; i < 5; i++) assert.equal((await f.send("POST", approve, "approval=0000000000000000")).status, 403);
  assert.equal((await f.redeem()).status, 403);
});

test("Next redirects use only the configured loopback port and approved Product routes", () => {
  const gate = { host, ownerAuthorized: true, trustedHttps: true };
  const target = "http://127.0.0.1:3001";
  const path = "/digital-observer/onboarding?type=business";
  assert.equal(observerOriginRedirect("https://localhost:3001" + path, target, gate), path);
  assert.equal(observerOriginRedirect("http://127.0.0.1:3001" + path, target, gate), path);
  for (const invalid of ["https://localhost:3000" + path, "https://localhost:3001.invalid" + path,
    "https://localhost:3001//elsewhere.invalid", "http://localhost:3001/api/auth/admin",
    "https://localhost:3001/a/../digital-observer/login"]) {
    assert.equal(observerOriginRedirect(invalid, target, gate), null);
  }
});

test("the owner gets readable retry and expiry screens on the phone", async t => {
  const f = await fixture(t);
  const invalid = await f.send("POST", approve, "approval=short");
  assert.equal(invalid.status, 403);
  assert.match(invalid.text, /הקוד שגוי/);
  assert.equal(invalid.headers["set-cookie"], undefined);
  assert.equal((await f.send("POST", approve, "approval=" + code.toUpperCase())).status, 303);
  const replay = await f.redeem();
  assert.equal(replay.status, 403);
  assert.match(replay.text, /האישור אינו זמין/);
  f.advance(120_000);
  const page = await f.send("GET", "/digital-observer/login");
  assert.equal(page.status, 403);
  assert.match(page.text, /פתיחת טופס הכניסה/);
  assert.ok(!page.text.includes('name="approval"'));
});

test("only immutable hashed build assets may be retained in the private device cache", async t => {
  const origin = createServer((req, res) => {
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    if (req.url.includes("cookie")) res.setHeader("set-cookie", "synthetic=yes");
    res.end("fixture");
  });
  await new Promise(resolve => origin.listen(0, "127.0.0.1", resolve));
  t.after(() => { origin.closeAllConnections(); origin.close(); });
  const f = await fixture(t, "http://127.0.0.1:" + origin.address().port);
  const cookie = (await f.redeem()).headers["set-cookie"][0].split(";")[0];
  f.advance(5000);
  const asset = "/_next/static/chunks/app-bad77390d05b4685.js";
  const result = await f.send("GET", asset, undefined, {cookie});
  assert.equal(result.headers["cache-control"], "private, max-age=1795, immutable");
  assert.equal(result.headers["cdn-cache-control"], "no-store");
  assert.equal((await f.send("GET", asset)).status, 403);
  for (const path of [asset.replace("app-", "cookie-"), asset.replace("bad77390d05b4685", "mutable"),
    "/digital-observer/onboarding", "/api/digital-observer/mobile/runtime"]) {
    assert.equal((await f.send("GET", path, undefined, {cookie})).headers["cache-control"], "no-store");
  }
});

test("opt-in QA proxy routes signed media only and drops misconfigured direct issuance", async t => {
  const sha = "a".repeat(40);
  const token = "b".repeat(43);
  const signed = `/qa/run/general/source/index.m3u8?r=${token}`;
  const mintPath = "/api/digital-observer/dvr-gateway";
  let direct = true;
  let mediaCalls = 0;
  const app = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: { playback: direct
      ? { claim_url: "https://edge.invalid/playback/claim", grant: "secret" }
      : { hls_url: `https://${host}${signed}`, qa_build_sha: sha } } }));
  });
  const media = createServer((req, res) => {
    mediaCalls++;
    assert.equal(req.url, signed);
    assert.equal(req.headers.cookie, undefined);
    res.writeHead(200, { "x-observer-qa-build": sha, "set-cookie": "unwanted=1" });
    res.end("#EXTM3U");
  });
  for (const listener of [app, media]) {
    await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
    t.after(() => { listener.closeAllConnections();listener.close(); });
  }
  const origin = listener => `http://127.0.0.1:${listener.address().port}`;
  const f = await fixture(t, origin(app), { mediaUpstream: origin(media), mediaSha: sha });
  const cookie = (await f.redeem()).headers["set-cookie"][0].split(";")[0];
  assert.equal((await f.send("POST", mintPath, "{}")).status, 403);
  assert.equal((await f.send("POST", mintPath, "{}", { cookie })).status, 404);
  direct = false;
  assert.equal((await f.send("POST", mintPath, "{}", { cookie })).status, 200);
  assert.equal((await f.send("GET", signed, undefined, { "x-forwarded-proto": "http" })).status, 403);
  const result = await f.send("GET", signed);
  assert.equal(result.status, 200);
  assert.equal(result.headers["set-cookie"], undefined);
  assert.equal(result.headers["referrer-policy"], "no-referrer");
  assert.equal(result.text, "#EXTM3U");
  for (const path of ["/internal/issue", "/hls/direct/index.m3u8", signed + "&r=" + token, "/playback/claim"]) {
    assert.equal((await f.send("GET", path, undefined, { cookie })).status, 404);
  }
  assert.equal(mediaCalls, 1);
});
