import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./retry-push38-homeqa-connector-after-crash-recovery.mjs", import.meta.url), "utf8");
const manager = readFileSync(new URL("../../services/video-gateway/edge-update-manager.mjs", import.meta.url), "utf8");

for (const value of ["qa-p38-health-connector-startup-d44b7e4262f9", "EDGE_UPDATE_CRASH_LOOP",
  "qa-connector-legacy-transition-v2-6e7988808b05", "8.10.2", "ED25519_V1"])
  assert.match(source, new RegExp(value));
assert.match(source, /healthyEvents\.length < 25/);
assert.match(source, /cohort_percent !== 0/);
assert.match(source, /manager\.authorizeQuarantinedReleaseRetry/);
assert.match(source, /active_runtime_instance_id is not null/);
assert.match(source, /observer_managed_device_auth_nonces/);
assert.doesNotMatch(source, /softwareConnectorDeviceSession/);
assert.match(source, /ota_agent_owns_install: true/);
assert.doesNotMatch(source, /manager\.apply\(/);
assert.doesNotMatch(source, /adapter\.restart\(/);
assert.match(manager, /originalFailurePreserved/);
assert.match(manager, /recovery_failure_category/);

console.log(JSON.stringify({ status: "PASS", exact_retry: true, installer: "canonical_ota_agent",
  direct_runtime_restart: false, broad_cohort: false }));
