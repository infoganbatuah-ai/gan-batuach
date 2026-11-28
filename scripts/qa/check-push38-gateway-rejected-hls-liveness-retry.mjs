import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "scripts/qa/retry-push38-homeqa-gateway-rejected-hls-after-liveness-fix.mjs", "utf8");

test("retry is bound to exact signed Gateway 0.2.88 and 0.2.87 rollback", () => {
  assert.match(source, /qa-p38-health-gateway-rejected-hls-continuity-9e07e63a5e3e/);
  assert.match(source, /9e07e63a5e3e27f64712986fe1ffcd1c485f258ce614af00e93050046ef1e8e8/);
  assert.match(source, /qa-p38-health-gateway-session-retirement-4409dc49c483/);
  assert.match(source, /authorization_attempt: 1/);
  assert.match(source, /priorRetries\.length !== 0/);
});

test("retry proves minimal liveness fix and preserves OTA ownership", () => {
  assert.match(source, /live\.ok && service\.running/);
  assert.match(source, /\/health\/live/);
  assert.match(source, /authorizeQuarantinedReleaseRetry/);
  assert.match(source, /ota_agent_owns_install: true/);
  assert.match(source, /camera_runtime_writes_by_command: 0/);
});

test("retry remains exact-device and broad-cohort closed", () => {
  assert.match(source, /cohort_percent=0/);
  assert.match(source, /explicit_device_ids/);
  assert.match(source, /status='ACTIVE' and cohort_percent<>0/);
  assert.match(source, /broad_cohort: false/);
});
