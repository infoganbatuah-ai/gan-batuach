import { readFileSync } from "node:fs";

const runner = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");

for (const required of [
  "EMPTY_DISCOVERY_CONFIRMATIONS = 3",
  "VERIFIED_CONNECTED_COUNT_KEY",
  "last_verified_connected_channel_count",
  "consecutiveEmptyDiscoveries",
  "channel_regression_pending_confirmation",
  "last known-good mapping",
  "discoverWithRetry(\"initial\")",
  "DISCOVERY_RETRY_DELAY_MS = 20_000"
]) {
  if (!runner.includes(required)) throw new Error(`Missing guarded discovery control: ${required}`);
}

console.log("Gateway discovery guard QA PASS");
