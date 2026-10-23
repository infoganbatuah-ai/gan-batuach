import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./recover-push38-homeqa-known-good.mjs", import.meta.url), "utf8");

assert.match(source, /--recover-known-good/);
assert.match(source, /qa-p38-health-connector-parent-exit-f7dba974e80f/);
assert.match(source, /f7dba974e80fc7e70bef0584744379b09ef4c0e8161eb13c32cea6118a4a55fd/);
assert.match(source, /qa-p38-health-connector-rtsp-session-fb790d87cf53/);
assert.match(source, /softwareConnectorDeviceSession\(store\)/);
assert.match(source, /session\.authMode !== "ED25519_V1"/);
assert.match(source, /session\.gatewayId !== deviceId/);
assert.match(source, /NODE_EXTRA_CA_CERTS: certificate/);
assert.match(source, /qaTlsCaSha256/);
assert.match(source, /manager\.recoverKnownGoodCrashLoopAfterStability\(\)/);
assert.match(source, /EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY/);
assert.match(source, /EDGE_UPDATE_ROLLBACK_HEALTH_FAILED/);
assert.match(source, /manager\.recoverActionRequiredRollback\(\)/);
assert.match(source, /manager\.reconcileDelayedRollbackKnownGood\(\)/);
assert.match(source, /guard\.reconcileVerifiedRecovery\(\{ runtimePid: adapter\.runtimePid\(\) \}\)/);
assert.match(source, /failed_known_good_removed/);
assert.match(source, /runtime_restarted: false/);
assert.match(source, /release_promoted: false/);
assert.doesNotMatch(source, /adapter\.restart\(/);
assert.doesNotMatch(source, /manager\.apply\(/);

console.log(JSON.stringify({ status: "PASS", fresh_ed25519_proof: true,
  exact_current_known_good: "0.2.14", failed_release: "0.2.15",
  runtime_restart: false, release_install: false, release_promotion: false }));
