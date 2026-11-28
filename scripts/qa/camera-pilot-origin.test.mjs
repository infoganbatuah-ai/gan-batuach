import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { isCameraPilotSameOrigin } from "../../lib/management/camera-pilot-grant.mjs";

const { NextRequest } = createRequire(import.meta.url)("next/server");
const origin = "http://127.0.0.1:3000";
const path = "/api/development/camera-pilot";
const headers = { Origin: origin, Host: "127.0.0.1:3000" };

test("accepts Next.js loopback normalization with exact original Origin and Host", () => {
  const request = new NextRequest(origin + path, { method: "POST", headers });
  assert.equal(new URL(request.url).origin, "http://localhost:3000");
  assert.equal(isCameraPilotSameOrigin(request), true);
  assert.equal(isCameraPilotSameOrigin(new Request(origin + path, { headers })), true);
});

test("rejects different origin, original host, URL port and camera query parameters", () => {
  for (const [url, requestHeaders] of [
    [origin + path, { ...headers, Origin: "http://localhost:3000" }],
    [origin + path, { ...headers, Host: "localhost:3000" }],
    [origin + path, { Host: headers.Host }],
    ["http://localhost:3001" + path, headers],
    [origin + path + "?camera=other", headers]
  ]) assert.equal(isCameraPilotSameOrigin(new NextRequest(url, { method: "POST", headers: requestHeaders })), false);
});
