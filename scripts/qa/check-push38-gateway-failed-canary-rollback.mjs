import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./rollback-push38-homeqa-gateway-after-failed-canary.mjs",
  import.meta.url), "utf8");
for (const required of [
  "failed-canary-result", "failed-canary-checkpoints",
  "1f45728786eb022e753ca261dcff60440dd236638b8554dc0d869f6dd1820777",
  "54d43daf62276fd643643e46b498965cf2a14acd59aec1e50053622e486855a6",
  "qa-p38-health-gateway-event-loop-cleanup-rb77-83aaf23ce84e",
  "qa-p38-health-gateway-device-identity-continuity-63cd90b08ec9",
  "rollbackAfterCrashLoop({ reason: \"EDGE_UPDATE_QUALIFICATION_FAILED\" })",
  "manager.verifySlot(current)", "manager.verifySlot(rollback)",
  "failed_release_quarantined", "ota_agent_restored"
]) assert.ok(source.includes(required), required);
assert.match(source, /const store = apply \? createEdgeSecretStoreSync/,
  "dry-run must not instantiate the mutating secure store");
assert.match(source, /if \(apply === dryRun\)/, "one explicit mode is required");
assert.doesNotMatch(source, /rmSync|unlinkSync|reset --hard|checkout --/,
  "rollback must use the canonical manager, not destructive shell cleanup");

console.log("PUSH 38 Gateway failed-canary rollback QA: PASS");
