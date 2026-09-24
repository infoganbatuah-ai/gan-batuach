import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextRelayRecovery, relayRecoveryIsStable, relayRetryDelayMs } from "../../services/video-gateway/relay-recovery-policy.mjs";

let state;
for (let failure = 1; failure <= 9; failure++) {
  state = nextRelayRecovery(state, 1_000);
  assert.equal(state.failures, Math.min(8, failure));
  assert.equal(relayRetryDelayMs(state, 1_000), Math.min(60_000, 500 * (2 ** Math.max(0, failure - 1))));
  assert.equal(relayRetryDelayMs(state, state.next_retry_at), 0);
}
assert.equal(relayRecoveryIsStable({ startedAt: 1_000 }, 60_999), false);
assert.equal(relayRecoveryIsStable({ startedAt: 1_000 }, 61_000), true);
assert.equal(nextRelayRecovery(state, 2_000).failures, 8, "a zero exit alone must not clear flapping history");
const runtime = readFileSync("services/video-gateway/server.mjs", "utf8");
const requestRecovery = runtime.indexOf("armRelayRecovery(streamId, existing)");
const requestStop = runtime.indexOf("stopRelay(streamId, existing)", requestRecovery);
assert.ok(requestRecovery >= 0 && requestStop > requestRecovery,
  "a playback request must arm backoff before it stops a stale relay");
const monitorRecovery = runtime.indexOf("armRelayRecovery(streamId, relay)", requestStop);
const monitorStop = runtime.indexOf("stopRelay(streamId, relay,", monitorRecovery);
assert.ok(monitorRecovery >= 0 && monitorStop > monitorRecovery,
  "the stale monitor must arm backoff before deleting the current relay");
assert.match(runtime, /if \(wasCurrent && relay\.stopReason !== "WARM_HANDOFF"\) armRelayRecovery\(streamId, relay\)/,
  "a natural child exit must use the same idempotent recovery arm");
console.log("push38b relay recovery policy: PASS");
