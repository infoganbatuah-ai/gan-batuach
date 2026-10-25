import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/qa/retry-push38-homeqa-connector-output-rescue.mjs", "utf8");

test("retry is bound to the exact signed Connector release and known-good rollback", () => {
  for (const value of [
    "db267b52-6282-4944-bcee-5d4857698fb0",
    "qa-p38-health-connector-output-rescue-b0b6ef01b6e1",
    "b0b6ef01b6e100b623ab68aa291ed5e4ab0e37edcf5b91e83777c43648549b08",
    "qa-p38-health-connector-rtsp-cadence-559bb01f78a2",
    "EDGE_UPDATE_CRASH_LOOP"
  ]) assert.match(source, new RegExp(value));
  assert.match(source, /manager\.verifySlot\(current\)/);
  assert.match(source, /manager\.verifySlot\(\{ version: VERSION/);
});

test("retry requires hours of prior signed-release health and current 1-of-1 health", () => {
  assert.match(source, /observations\.length < 100/);
  assert.match(source, /durationMs < 7 \* 60 \* 60_000/);
  assert.match(source, /filter\(\(item\) => item\.state === "ROLLBACK_REQUIRED"[\s\S]*?\)\.at\(-1\)/);
  assert.match(source, /sample\.assigned !== 1/);
  assert.match(source, /sample\.progressing !== 1/);
  assert.match(source, /sample\.stalled !== 0/);
});

test("retry preserves exact targeting and leaves install and rollback to OTA", () => {
  assert.match(source, /cohort_percent !== 0/);
  assert.match(source, /explicit_device_ids: \[DEVICE_ID\]/);
  assert.match(source, /authorizeQuarantinedReleaseRetry/);
  assert.match(source, /ota_agent_owns_install: true/);
  assert.match(source, /functional_runtime_changed_by_command: false/);
  assert.doesNotMatch(source, /manager\.apply|adapter\.install/);
});
