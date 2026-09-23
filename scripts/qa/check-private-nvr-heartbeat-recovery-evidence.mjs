import assert from "node:assert/strict";
import { createPrivateNvrHeartbeat } from
  "../../services/video-gateway/private-nvr-heartbeat.mjs";

let now = Date.parse("2026-09-23T22:40:00.000Z");
let healthy = false;
const heartbeat = createPrivateNvrHeartbeat({
  sessions: () => [{ baseUrl: "http://127.0.0.1:9999", token: "fixture-token" }],
  now: () => now,
  fetchImpl: async () => new Response(JSON.stringify(healthy
    ? { result: "success" }
    : { result: "failed" }), { status: 200, headers: { "content-type": "application/json" } })
});

for (let index = 0; index < 3; index += 1) {
  await heartbeat.tick();
  now += 10_000;
}
assert.equal(heartbeat.status().consecutive_failures, 3);
assert.equal(heartbeat.status().failures, 3);
assert.ok(heartbeat.status().last_failure_at);

healthy = true;
await heartbeat.tick();
assert.equal(heartbeat.status().consecutive_failures, 0,
  "a valid recorder heartbeat must clear only the consecutive failure streak");
assert.equal(heartbeat.status().failures, 3,
  "historical heartbeat failures remain observable");
assert.equal(heartbeat.status().responses_ok, 1);

console.log("private DVR heartbeat recovery evidence: PASS");
