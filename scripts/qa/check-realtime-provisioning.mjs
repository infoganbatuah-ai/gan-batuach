import assert from "node:assert/strict";
import worker from "../../services/realtime-control/worker.mjs";

for (const env of [{}, { CF_RTC_APP_ID: "synthetic-app", CF_RTC_APP_SECRET: "synthetic-secret" }]) {
  const response = await worker.fetch(new Request("https://video-relay.ganbatuach.com/health"), env);
  const payload = await response.json();
  assert.equal(payload.sfu_configured, Boolean(env.CF_RTC_APP_ID));
  assert.equal(payload.signaling_enabled, false);
  assert.equal(payload.live_verified, false);
  assert.equal(payload.records_media, false);
  assert.equal(JSON.stringify(payload).includes("synthetic"), false);
  const blocked = await worker.fetch(new Request("https://video-relay.ganbatuach.com/playback/claim", { method: "POST", body: "test" }), env);
  assert.equal(blocked.status, 503);
}
console.log("Realtime provisioning QA PASS: credentials hidden; signaling and live remain disabled");
