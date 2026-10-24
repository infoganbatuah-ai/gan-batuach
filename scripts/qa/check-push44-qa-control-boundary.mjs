import assert from "node:assert/strict";
import test from "node:test";
import { qaDeviceControlBoundary, readQaDeviceBoundedBody } from "../../lib/domain/digital-observer/qa-device-control-boundary.ts";

const host = "qa-iphone-device-proof.ganbatuach.com";
const now = 1_800_000_000_000;
const key = "k".repeat(43);
const base = {
  PUSH44_QA_CONTROL_ONLY: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421/",
  PUSH44_QA_LOCAL_TRANSPORT_URL: "http://127.0.0.1:45678/",
  PUSH44_QA_CONTROL_DEADLINE_MS: String(now + 30 * 60_000),
  PUSH44_QA_PROXY_KEY: key
};
function request({ url = `https://${host}/api/digital-observer/qa-device`, headers = {} } = {}) {
  return new Request(url, { method: "POST", headers: {
    host, origin: `https://${host}`, "x-forwarded-proto": "https",
    "x-do-qa-proxy-key": key, "content-type": "application/json", ...headers
  }, body: "{}" });
}

test("only exact control host, trusted proxy, local Development and bounded deadline pass", () => {
  assert.equal(qaDeviceControlBoundary(request(), base, now)?.host, "127.0.0.1:45678");
  assert.equal(qaDeviceControlBoundary(request(), {}, now), null);
  assert.equal(qaDeviceControlBoundary(request(), { ...base, VERCEL: "1" }, now), null);
  assert.equal(qaDeviceControlBoundary(request(), { ...base,
    NEXT_PUBLIC_SUPABASE_URL: "https://kuaywzvucllxjsxarogb.supabase.co" }, now), null);
  assert.equal(qaDeviceControlBoundary(request(), { ...base,
    PUSH44_QA_LOCAL_TRANSPORT_URL: "http://192.168.1.10:45678/" }, now), null);
  assert.equal(qaDeviceControlBoundary(request(), { ...base,
    PUSH44_QA_CONTROL_DEADLINE_MS: String(now) }, now), null);
  assert.equal(qaDeviceControlBoundary(request(), { ...base,
    PUSH44_QA_CONTROL_DEADLINE_MS: String(now + 30 * 60_000 + 1) }, now), null);
});

test("host spoofing, insecure forwarding, proxy-key theft assumptions and oversized bodies deny", () => {
  for (const options of [
    { url: `https://evil.invalid/api/digital-observer/qa-device` },
    { url: `http://${host}/api/digital-observer/qa-device` },
    { headers: { host: "evil.invalid" } },
    { headers: { origin: "https://evil.invalid" } },
    { headers: { "x-forwarded-proto": "http" } },
    { headers: { "x-forwarded-host": "evil.invalid" } },
    { headers: { "x-do-qa-proxy-key": "wrong" } },
    { headers: { authorization: "Bearer copied-token" } },
    { headers: { "content-length": "2049" } }
  ]) assert.equal(qaDeviceControlBoundary(request(options), base, now), null);
});

test("streamed body stops at the 2,048-byte ceiling without parsing or forwarding", async () => {
  assert.equal(await readQaDeviceBoundedBody(request()), "{}");
  const large = new Request(`https://${host}/api/digital-observer/qa-device`, {
    method: "POST", body: "x".repeat(2049)
  });
  assert.equal(await readQaDeviceBoundedBody(large), null);
});
