import assert from "node:assert/strict";
import { createPrivateNvrHeartbeat } from "../../services/video-gateway/private-nvr-heartbeat.mjs";

const session = { baseUrl: "http://recorder.invalid", token: "fixture-auth", cookie: "fixture-cookie" };
let calls = 0, release;
const heartbeat = createPrivateNvrHeartbeat({ sessions: () => [session], now: () => 1000, fetchImpl: async (url, init) => {
  calls++;
  assert.equal(String(url), "http://recorder.invalid/API/Login/Heartbeat");
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  assert.deepEqual(JSON.parse(init.body), { version: "1.0", data: {} });
  assert.equal(init.headers["x-csrftoken"], "fixture-auth");
  await new Promise(resolve => { release = resolve; });
  return Response.json({ result: "success" });
} });
const first = heartbeat.tick(), duplicate = heartbeat.tick();
assert.equal(first, duplicate);
await new Promise(resolve => setImmediate(resolve));
assert.equal(calls, 1);
release();
await first;
assert.equal(heartbeat.status().responses_ok, 1);
assert.equal(heartbeat.status().last_response_at, "1970-01-01T00:00:01.000Z");
assert.doesNotMatch(JSON.stringify(heartbeat.status()), /fixture|recorder\.invalid|token|cookie|password/);
for (const response of [Response.json({ result: "failed" }), Response.json({}, { status: 401 }), new Response("invalid"), new Response("x".repeat(17000))]) {
  const failed = createPrivateNvrHeartbeat({ sessions: () => [session], fetchImpl: async () => response });
  await failed.tick();
  assert.equal(failed.status().responses_ok, 0);
  assert.equal(failed.status().failures, 1);
}
const broken = createPrivateNvrHeartbeat({ sessions: () => [session], fetchImpl: async () => { throw Error("private upstream error"); } });
await broken.tick(); await broken.tick();
assert.equal(broken.status().attempts, 2);
assert.equal(broken.status().failures, 2);
const skip = createPrivateNvrHeartbeat({ sessions: () => [{ ...session, refreshPromise: Promise.resolve() }], fetchImpl: async () => assert.fail("Never heartbeat an identity being rotated") });
await skip.tick();
assert.equal(skip.status().attempts, 0);
const listFailed = createPrivateNvrHeartbeat({ sessions: () => { throw Error("fixture failure"); } });
await listFailed.tick();
assert.equal(listFailed.status().failures, 1);
console.log("PASS: exact vendor heartbeat, no controls/login, bounded response, single-flight, sanitized diagnostics and failure isolation");
