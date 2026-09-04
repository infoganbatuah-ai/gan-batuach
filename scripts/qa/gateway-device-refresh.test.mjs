import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { refreshDeviceCredentials } from "../../services/video-gateway/device-refresh.mjs";

const gatewayId = "00000000-0000-4000-8000-000000000001";

test("device refresh rotates to the client-prepared token atomically", async () => {
  const secrets = new Map([["device_refresh_token", "p".repeat(48)]]);
  let requestedNext = "";
  const result = await refreshDeviceCredentials({
    gatewayId,
    cloudBaseUrl: "https://gateway.example.invalid",
    readSecret: async (key) => secrets.get(key) ?? "",
    writeSecret: async (key, value) => { secrets.set(key, value); },
    removeSecret: async (key) => { secrets.delete(key); },
    fetcher: async (_url, options) => {
      const body = JSON.parse(String(options.body));
      requestedNext = body.next_refresh_token;
      assert.equal(body.refresh_token, "p".repeat(48));
      assert.equal(requestedNext.length >= 32, true);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: {
          rotation_protocol: 2,
          refresh_token: requestedNext,
          access_token: "access-token",
          access_expires_at: new Date(Date.now() + 600_000).toISOString()
        } })
      };
    }
  });

  assert.equal(result.accessToken, "access-token");
  assert.equal(secrets.get("device_refresh_token"), requestedNext);
  assert.equal(secrets.has("device_refresh_pending"), false);
});

test("cloud refresh route implements rotation protocol v2", () => {
  const source = readFileSync("app/api/digital-observer/gateway-enrollment/route.ts", "utf8");
  assert.match(source, /next_refresh_token:\s*z\.string\(\)\.min\(32\)\.max\(160\)/);
  assert.match(source, /const nextRefreshToken = payload\.next_refresh_token/);
  assert.match(source, /rotation_protocol:\s*2/);
});
