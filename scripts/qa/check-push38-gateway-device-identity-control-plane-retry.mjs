import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "scripts/qa/retry-push38-homeqa-gateway-device-identity-after-control-plane-reconciliation.mjs",
  "utf8");
for (const token of [
  "PUSH38_GATEWAY_DEVICE_IDENTITY_CONTINUITY",
  "authorizeQuarantinedReleaseRetry", "EDGE_UPDATE_CRASH_LOOP",
  "MANAGED_IDENTITY_VERIFIED", "PRODUCT_OWNER_CONSENT_READ_ONLY",
  "connector_config_version", "deviceAuthorization", "approval_required", "ready",
  "explicit_device_ids", "cohort_percent=0", "broad_active", "statfsSync",
  "AUTHORIZE_ONE_TIME_EXACT_0_2_77_RETRY", "ota_agent_owns_install: true",
  "runtime_writes_by_command: 0", "new_cost: false"
]) assert.ok(source.includes(token), token);
assert.match(source, /priorHealthyMs < 60 \* 60_000/);
assert.match(source, /oneMinuteLoad > logicalCpu \* 1\.5/);
assert.match(source, /priorRetries\.length !== 0/);
assert.match(source, /manager\.verifySlot\(current\)/);
assert.match(source, /connectorManager\.verifySlot\(connectorCurrent\)/);
assert.doesNotMatch(source, /device_private_key/);
assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(source, /cohort_percent\s*=\s*100/);
console.log("PUSH38_GATEWAY_DEVICE_IDENTITY_CONTROL_PLANE_RETRY_QA_PASS");
