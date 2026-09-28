import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/qa/retry-push38-homeqa-connector-restart-grace-after-source-recovery.mjs", "utf8");
for (const required of [
  "PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY",
  "EDGE_UPDATE_CAMERA_PROGRESSION_FAILED",
  "manager.authorizeQuarantinedReleaseRetry",
  "source_recovered_on_signed_known_good",
  "fresh_proof",
  "cohort_percent !== 0",
  "broad_active !== 0",
  "ota_agent_owns_install: true",
  "functional_runtime_changed_by_command: false"
]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(source, /sample\.expected !== 1/);
assert.match(source, /sample\.connected !== 1/);
assert.match(source, /sample\.progressing !== 1/);
assert.match(source, /sample\.stalled !== 0/);
assert.match(source, /new Set\(samples\.map\(sample => sample\.pid\)\)\.size !== 1/);
assert.match(source, /manager\.verifySlot\(current\)/);
assert.match(source, /manager\.verifySlot\(\{ version: item\.version/);
assert.doesNotMatch(source, /manager\.apply|adapter\.install|launchctl.*bootout/);
console.log(JSON.stringify({ status: "PASS", exact_device: true, one_retry_only: true,
  signed_manifest: true, healthy_source_samples: 6, ota_agent_owns_install: true }));
