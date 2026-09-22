import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./recover-push38-homeqa-known-good.mjs", import.meta.url), "utf8");

assert.match(source, /--recover-known-good/);
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
assert.match(source, /failed_known_good_removed/);
assert.match(source, /runtime_restarted: false/);
assert.match(source, /release_promoted: false/);
assert.doesNotMatch(source, /adapter\.restart\(/);
assert.doesNotMatch(source, /manager\.apply\(/);

console.log(JSON.stringify({ status: "PASS", fresh_ed25519_proof: true,
  runtime_restart: false, release_install: false, release_promotion: false }));
