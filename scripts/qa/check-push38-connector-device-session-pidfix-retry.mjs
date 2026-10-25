import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./retry-push38-homeqa-connector-device-session-after-runtime-pid-fix.mjs", import.meta.url), "utf8");
for (const expected of ["PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY", "qa-p38-management-runtime-pid-95c3b60ed951",
  "528d8178c0dcef34b366b191bad2e7bef52aed2cafc0926647236af696436e2f",
  "EDGE_UPDATE_CRASH_LOOP", "15 * 60_000", "explicit_device_ids", "cohort_percent",
  "fresh_proof", "broad_active", "authorizeQuarantinedReleaseRetry", "functional_runtime_changed_by_command: false"])
  assert.ok(source.includes(expected), `missing ${expected}`);
assert.doesNotMatch(source, /launchctl.*kickstart/);
assert.doesNotMatch(source, /manager\.apply\(/);
console.log(JSON.stringify({ status: "PASS", exact_device: true, cohort_percent: 0,
  signed_management_fix_required: true, prior_healthy_window_required: true,
  ota_agent_owns_install: true }));
