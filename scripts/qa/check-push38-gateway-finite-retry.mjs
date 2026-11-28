import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const retry = readFileSync("scripts/qa/retry-push38-homeqa-gateway-finite-handoff.mjs", "utf8");
const driver = readFileSync("scripts/qa/drive-push38-gateway-install-health.mjs", "utf8");

test("retry binds the exact signed release, rollback state, and exact-device rollout", () => {
  for (const value of ["qa-p38-health-gateway-finite-handoff-76781a8e0832",
    "76781a8e08328feb154525451c5c4a26aaca43739279f9a052280758d1a02ffb",
    "62df97e2-3c0b-427f-9108-bde029bc10e7", "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED"])
    assert.match(retry, new RegExp(value));
  assert.match(retry, /manager\.authorizeQuarantinedReleaseRetry/);
  assert.match(retry, /cohort_percent !== 0/);
  assert.match(retry, /ota_agent_owns_install: true/);
  assert.doesNotMatch(retry, /manager\.apply|adapter\.install/);
});

test("retry requires recovered 8-of-8 media truth before clearing quarantine", () => {
  for (const check of ["sample.connected !== 8", "sample.failed !== 2", "sample.empty !== 6",
    "sample.progressing !== 8", "sample.stalled !== 0"]) assert.match(retry, new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("health driver is loopback-only, exact-channel, and never changes configuration", () => {
  assert.match(driver, /Object\.freeze\(\[1, 3, 4, 5, 6, 7, 10, 11\]\)/);
  assert.match(driver, /http:\/\/127\.0\.0\.1:18082\/camera/);
  assert.match(driver, /configuration_writes: 0/);
  assert.match(driver, /runtime_file_writes: 0/);
  assert.match(driver, /observed\.progressing === 8/);
  assert.doesNotMatch(driver, /\/dvr\/connect|restart|launchctl/);
});
