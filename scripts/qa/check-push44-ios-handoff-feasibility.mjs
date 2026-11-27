import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { after, test } from "node:test";
import { createQaProxy } from "./push44-owner-qa-proxy.mjs";

// This exercises the existing proxy with synthetic credentials only. It is a
// blocker characterization, not an implementation of a safe iOS handoff.
const syntheticToken = "a".repeat(64);
const qaHost = "qa-iphone-feasibility.ganbatuach.com";
let now = 1_000_000;
const upstream = createServer((_incoming, outgoing) => outgoing.writeHead(200).end("synthetic-origin"));
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const proxy = createQaProxy({
  now: () => now,
  upstream: `http://127.0.0.1:${upstream.address().port}`,
  ownerToken: syntheticToken,
  qaHost,
  expiresAt: now + 30_000
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
after(async () => {
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
});

function get(path, cookie) {
  return new Promise((resolve, reject) => {
    const headers = { host: qaHost };
    if (cookie) headers.cookie = cookie;
    const call = request({ hostname: "127.0.0.1", port: proxy.address().port, method: "GET", path, headers }, (response) => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers }));
    });
    call.on("error", reject);
    call.end();
  });
}

test("current bootstrap is bearer-in-URL and replayable without session or device binding", async () => {
  const path = `/__push44/bootstrap?t=${syntheticToken}`;
  assert.ok(path.includes(syntheticToken), "the bearer is present in the request target");
  const first = await get(path);
  const replay = await get(path);
  assert.equal(first.status, 303);
  assert.equal(replay.status, 303, "the current bootstrap has no one-time consumption");
  assert.match(first.headers["set-cookie"]?.[0] ?? "", /HttpOnly; Secure; SameSite=Lax/);
});

test("a browser cookie is not an authenticated native WebView handoff", async () => {
  const browser = await get(`/__push44/bootstrap?t=${syntheticToken}`);
  const browserCookie = browser.headers["set-cookie"]?.[0]?.split(";")[0];
  assert.ok(browserCookie);
  assert.equal((await get("/digital-observer/login")).status, 401,
    "the independent WebView request has no cookie; sharing has not been established");
  assert.equal((await get("/digital-observer/login", browserCookie)).status, 200,
    "copying the bearer cookie would grant access, but is not an approved transfer mechanism");
});

test("the route expires, but expiry alone cannot make a handoff one-use", async () => {
  now += 30_000;
  assert.equal((await get(`/__push44/bootstrap?t=${syntheticToken}`)).status, 410);
});
