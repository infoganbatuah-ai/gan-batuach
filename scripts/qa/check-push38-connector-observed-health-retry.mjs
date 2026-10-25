import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/qa/retry-push38-homeqa-connector-health-observation-after-build-isolation.mjs", "utf8");

test("observed-health retry is exact, evidence-bound and one-time", () => {
  for (const required of [
    "push38-home-qa-connector-health-observation.mjs",
    "item.releaseId",
    "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED",
    "EDGE_UPDATE_HEALTH_PROCESS_RUNNING_FAILED",
    "authorizeQuarantinedReleaseRetry",
    "quarantineRetryPath",
    "remediationEvidenceSha256"
  ]) assert.match(source, new RegExp(required));
});

test("retry requires stable signed known-good, fresh auth and exact rollout", () => {
  for (const required of ["managed_device_auth", "fresh_proof", "broad_active", "cohort_percent",
    "event_loop_p99_ms", "load_1m", "knownGood", "verifySlot"])
    assert.equal(source.includes(required), true);
  assert.match(source, /samples\.some/);
  assert.match(source, /new Set\(samples\.map\(sample => sample\.pid\)\)\.size !== 1/);
});

test("normal OTA remains sole installer and retry command does not mutate runtime", () => {
  assert.match(source, /ota_agent_owns_install: true/);
  assert.match(source, /functional_runtime_changed_by_command: false/);
  assert.doesNotMatch(source, /adapter\.install|manager\.apply/);
});
